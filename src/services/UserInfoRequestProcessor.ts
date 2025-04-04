 
 
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
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";
import { EnvironmentVariables } from "../utils/Constants";
import { TxmaEventNames } from "../models/enums/TxmaEvents";


export class UserInfoRequestProcessor {
  
	private static instance: UserInfoRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly cicService: CicService;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	private readonly verifiableCredentialService: VerifiableCredentialService;

	private readonly issuer: string;

	private readonly txmaQueueUrl: string;

	private readonly personIdentityTableName: string;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;
		
		const sessionTableName: string = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE, logger);
  		const signingKeyArn: string = checkEnvironmentVariable(EnvironmentVariables.KMS_KEY_ARN, logger);
		const dns_suffix = checkEnvironmentVariable(EnvironmentVariables.DNS_SUFFIX, logger);
		this.issuer = checkEnvironmentVariable(EnvironmentVariables.ISSUER, logger);
		this.txmaQueueUrl = checkEnvironmentVariable(EnvironmentVariables.TXMA_QUEUE_URL, this.logger);
		this.personIdentityTableName = checkEnvironmentVariable(EnvironmentVariables.PERSON_IDENTITY_TABLE_NAME, this.logger);
		
		this.cicService = CicService.getInstance(sessionTableName, this.logger, createDynamoDbClient());
		this.kmsJwtAdapter = new KmsJwtAdapter(signingKeyArn, logger);
		this.verifiableCredentialService = VerifiableCredentialService.getInstance(sessionTableName, this.kmsJwtAdapter, this.issuer, this.logger, dns_suffix);
	}

	static getInstance(logger: Logger, metrics: Metrics): UserInfoRequestProcessor {
		if (!UserInfoRequestProcessor.instance) {
			UserInfoRequestProcessor.instance = new UserInfoRequestProcessor(logger, metrics);
		}
		return UserInfoRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		// Validate the Authentication header and retrieve the sub (sessionId) from the JWT token.
		let sessionId: string;
		try {
			sessionId = await this.validationHelper.eventToSubjectIdentifier(this.kmsJwtAdapter, event);
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
		this.logger.appendKeys({ sessionId });

		let session: ISessionItem | undefined;
		let personInfo: PersonIdentityItem | undefined;
		try {
			session = await this.cicService.getSessionById(sessionId);
			if (!session) {
				this.logger.error("No session found", {
					messageCode: MessageCodes.SESSION_NOT_FOUND,
				});
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
			}
		} catch (error) {
			this.logger.error("Error finding session", {
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
			personInfo = await this.cicService.getPersonIdentityBySessionId(sessionId, this.personIdentityTableName);
			if (!personInfo) {
				this.logger.error("No person found with this session ID", {
					messageCode: MessageCodes.PERSON_NOT_FOUND,
				});
				return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
			}
		} catch (error) {
			this.logger.error("Error finding person", {
				error,
				messageCode: MessageCodes.SERVER_ERROR,
			});
			return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
		}

		this.logger.info("Found person by session ID");
  
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
				signedJWT = await this.verifiableCredentialService.generateSignedVerifiableCredentialJwt(
					session,
					names,
					birthDate,
					absoluteTimeNow,
				);
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
				await this.cicService.sendToTXMA(this.txmaQueueUrl, {
					event_name: TxmaEventNames.CIC_CRI_VC_ISSUED,
					...buildCoreEventFields(session, this.issuer, session.clientIpAddress),
					restricted: {
						name: [{
							nameParts: names,
						},
						],
						birthDate: [{ value: birthDate }],
					},
				});
			} catch (error) {
				this.logger.error("Failed to write TXMA event CIC_CRI_VC_ISSUED to SQS queue.", {
					error,
					messageCode: MessageCodes.ERROR_WRITING_TXMA,
				});
			}
			
			try {
				await this.cicService.sendToTXMA(this.txmaQueueUrl, {
					event_name: TxmaEventNames.CIC_CRI_END,
					...buildCoreEventFields(session, this.issuer, session.clientIpAddress),
				});
			} catch (error) {
				this.logger.error("Failed to write TXMA event CIC_CRI_END to SQS queue", {
					error, 
					messageCode: MessageCodes.ERROR_WRITING_TXMA,
				});
			}

			// return success response
			return new Response(HttpCodesEnum.OK, JSON.stringify({
				sub: session.subject,
				"https://vocab.account.gov.uk/v1/credentialJWT": [signedJWT],
			}));
		} else {
			this.logger.error("Claimed Identity data invalid", {
				messageCode: MessageCodes.INVALID_CLAIMED_IDENTITY,
			});
			return new Response(HttpCodesEnum.BAD_REQUEST, "Bad Request");
		}
	}
}

