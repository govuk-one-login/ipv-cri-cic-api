import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { AppError } from "../utils/AppError";
import { VerifiableCredentialService } from "../utils/VerifiableCredentialService";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { ISessionItem } from "../models/ISessionItem";
import { PersonIdentityItem } from "../models/PersonIdentityItem";
import { AuthSessionState } from "../models/enums/AuthSessionState";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { MessageCodes } from "../models/enums/MessageCodes";

const SESSION_TABLE = process.env.SESSION_TABLE;
const KMS_KEY_ARN = process.env.KMS_KEY_ARN;
const ISSUER = process.env.ISSUER!;

export class UserInfoRequestProcessor {
	private static instance: UserInfoRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly cicService: CicService;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	private readonly verifiableCredentialService: VerifiableCredentialService;

	constructor(logger: Logger, metrics: Metrics) {
		if (!SESSION_TABLE || !ISSUER || !KMS_KEY_ARN) {
			logger.error("Environment variable SESSION_TABLE or ISSUER or KMS_KEY_ARN is not configured", {
				messageCode: MessageCodes.MISSING_CONFIGURATION,
			});
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
		}
		this.logger = logger;
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;
		this.cicService = CicService.getInstance(SESSION_TABLE, this.logger, createDynamoDbClient());
		this.kmsJwtAdapter = new KmsJwtAdapter(KMS_KEY_ARN);
		this.verifiableCredentialService = VerifiableCredentialService.getInstance(SESSION_TABLE, this.kmsJwtAdapter, ISSUER, this.logger);
	}

	static getInstance(logger: Logger, metrics: Metrics): UserInfoRequestProcessor {
		if (!UserInfoRequestProcessor.instance) {
			UserInfoRequestProcessor.instance = new UserInfoRequestProcessor(logger, metrics);
		}
		return UserInfoRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		// Validate the Authentication header and retrieve the sub (sessionId) from the JWT token.
		let sub: string;
		try {
			sub = await this.validationHelper.eventToSubjectIdentifier(this.kmsJwtAdapter, event);
		} catch (error) {
			if (error instanceof AppError) {
				this.logger.error("Error validating Authentication Access token from headers: ", {
					error,
					messageCode: MessageCodes.INVALID_AUTH_CODE,
				});
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
			}
			this.logger.error("Unexpected error occurred", {
				error,
				messageCode: MessageCodes.SERVER_ERROR,
			});
			return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
		}

		// add sessionId to all subsequent log messages
		this.logger.appendKeys({ sessionId: sub });

		let session: ISessionItem | undefined;
		let personInfo: PersonIdentityItem | undefined;
		try {
			session = await this.cicService.getSessionById(sub);
			if (!session) {
				this.logger.error("No session found", {
					messageCode: MessageCodes.SESSION_NOT_FOUND,
				});
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
			}
		} catch (error) {
			this.logger.error("Error finding session", {
				sessionId: sub,
				error,
				messageCode: MessageCodes.SERVER_ERROR,
			});
			return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
		}

		// add govuk_signin_journey_id to all subsequent log messages
		this.logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

		this.logger.info("Found Session:", {
			// note: we only log specific non-PII attributes from the session object:
			session: {
				authSessionState: session.authSessionState,
				accessTokenExpiryDate: session.accessTokenExpiryDate,
				attemptCount: session.attemptCount,
				authorizationCodeExpiryDate: session.authorizationCodeExpiryDate,
				createdDate: session.createdDate,
				expiryDate: session.expiryDate,
				redirectUri: session.redirectUri,
			},
		});
  
		this.metrics.addMetric("found session", MetricUnits.Count, 1);

		try {
			personInfo = await this.cicService.getPersonIdentityBySessionId(sub);
			if (!personInfo) {
				this.logger.error("No person found with this session ID", {
					messageCode: MessageCodes.PERSON_NOT_FOUND,
				});
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
			}
		} catch (error) {
			this.logger.error("Error finding person", {
				sessionId: sub,
				error,
				messageCode: MessageCodes.SERVER_ERROR,
			});
			return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
		}

		this.logger.info("Found Person")
  
		this.metrics.addMetric("found person", MetricUnits.Count, 1);
		
		// Validate the AuthSessionState to be "CIC_ACCESS_TOKEN_ISSUED"
		if (session.authSessionState !== AuthSessionState.CIC_ACCESS_TOKEN_ISSUED) {
			this.logger.error("Session is in wrong Auth state", {
				// note: we only log specific non-PII attributes from the session object:
				expectedSessionState: AuthSessionState.CIC_ACCESS_TOKEN_ISSUED,
				session: {
					authSessionState: session.authSessionState,
				},
				messageCode: MessageCodes.STATE_MISMATCH,
			});
			return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
		}
		
		// Person info required for VC
		const names = personInfo.personNames[0].nameParts;
		const birthDate = personInfo.birthDates[0].value;
		// Validate the User Info data presence required to generate the VC
		if (names && names.length > 0 && birthDate) {

		//Generate VC and create a signedVC as response back to IPV Core.
		let signedJWT;
		try {
			signedJWT = await this.verifiableCredentialService.generateSignedVerifiableCredentialJwt(session, names, birthDate, absoluteTimeNow);
		} catch (error) {
			if (error instanceof AppError) {
				this.logger.error("Error generating signed verifiable credential jwt", {
					error,
					messageCode: MessageCodes.ERROR_SIGNING_VC,
				});
				return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
			}
		}
		// Add metric and send TXMA event to the sqsqueue
		this.metrics.addMetric("Generated signed verifiable credential jwt", MetricUnits.Count, 1);
		try {
			await this.cicService.sendToTXMA({
				event_name: "CIC_CRI_VC_ISSUED",
				...buildCoreEventFields(session, ISSUER, session.clientIpAddress, absoluteTimeNow),

			});
		} catch (error) {
			this.logger.error("Failed to write TXMA event CIC_CRI_VC_ISSUED to SQS queue.", {
				error,
				messageCode: MessageCodes.ERROR_WRITING_TXMA,
			});
		}
		// return success response
		return new Response(HttpCodesEnum.OK, JSON.stringify({
			sub: session.clientId,
			"https://vocab.account.gov.uk/v1/credentialJWT": [signedJWT],
		}))} else {

			this.logger.error("Claimed Identity data invalid", {
					messageCode: MessageCodes.INVALID_CLAIMED_IDENTITY,
				});
				return new Response(HttpCodesEnum.BAD_REQUEST, "Bad Request");
		}
	}
}

