import { Response, GenericServerError, unauthorizedResponse, SECURITY_HEADERS } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { randomUUID } from "crypto";
import { ISessionItem } from "../models/ISessionItem";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { ValidationHelper } from "../utils/ValidationHelper";
import { JwtPayload, Jwt } from "../utils/IVeriCredential";
import { MessageCodes } from "../models/enums/MessageCodes";
import { Constants, EnvironmentVariables } from "../utils/Constants";
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";


interface ClientConfig {
	jwksEndpoint: string;
	clientId: string;
	redirectUri: string;
}

export class SessionRequestProcessor {
	private static instance: SessionRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly cicService: CicService;

	private readonly kmsDecryptor: KmsJwtAdapter;

	private readonly validationHelper: ValidationHelper;

	private readonly issuer: string;

	private readonly authSessionTtlInSecs: string;

	private readonly clientConfig: string;

	private readonly txmaQueueUrl: string;

	constructor(logger: Logger, metrics: Metrics) {

		this.logger = logger;
		this.metrics = metrics;
		logger.debug("metrics is  " + JSON.stringify(this.metrics));
		this.metrics.addMetric("Called", MetricUnits.Count, 1);
		
		const sessionTableName: string = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE, this.logger);
  		const encryptionKeyIds: string = checkEnvironmentVariable(EnvironmentVariables.ENCRYPTION_KEY_IDS, this.logger);
		this.issuer = checkEnvironmentVariable(EnvironmentVariables.ISSUER, this.logger);
		this.authSessionTtlInSecs = checkEnvironmentVariable(EnvironmentVariables.AUTH_SESSION_TTL, this.logger);
		this.clientConfig = checkEnvironmentVariable(EnvironmentVariables.CLIENT_CONFIG, this.logger);
		this.txmaQueueUrl = checkEnvironmentVariable(EnvironmentVariables.TXMA_QUEUE_URL, this.logger);
  		
		this.cicService = CicService.getInstance(sessionTableName, this.logger, createDynamoDbClient());
		this.kmsDecryptor = new KmsJwtAdapter(encryptionKeyIds);
		this.validationHelper = new ValidationHelper();
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionRequestProcessor {
		if (!SessionRequestProcessor.instance) {
			SessionRequestProcessor.instance = new SessionRequestProcessor(logger, metrics);
		}
		return SessionRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		const deserialisedRequestBody = JSON.parse(event.body as string);
		const requestBodyClientId = deserialisedRequestBody.client_id;
		const clientIpAddress = event.requestContext.identity?.sourceIp ?? null;

		let configClient: ClientConfig | undefined = undefined;
		try {
			const config = JSON.parse(this.clientConfig) as ClientConfig[];
			configClient = config.find(c => c.clientId === requestBodyClientId);
		} catch (error) {
			this.logger.error("Invalid or missing client configuration table", {
				error,
				messageCode: MessageCodes.MISSING_CONFIGURATION,
			});
			return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
		}
		if (!configClient) {
			this.logger.error("Unrecognised client in request", {
				messageCode: MessageCodes.UNRECOGNISED_CLIENT,
			});
			return new Response(HttpCodesEnum.BAD_REQUEST, "Bad Request");
		}

		let urlEncodedJwt: string;
		try {
			urlEncodedJwt = await this.kmsDecryptor.decrypt(deserialisedRequestBody.request);
		} catch (error) {
			this.logger.error("Failed to decrypt supplied JWE request", {
				error,
				messageCode: MessageCodes.FAILED_DECRYPTING_JWE,
			});
			return unauthorizedResponse();
		}

		let parsedJwt: Jwt;
		try {
			parsedJwt = this.kmsDecryptor.decode(urlEncodedJwt);
		} catch (error) {
			this.logger.error("Failed to decode supplied JWT", {
				error,
				messageCode: MessageCodes.FAILED_DECODING_JWT,
			});
			return unauthorizedResponse();
		}

		const jwtPayload : JwtPayload = parsedJwt.payload;
		try {
			if (configClient?.jwksEndpoint) {
				const payload = await this.kmsDecryptor.verifyWithJwks(urlEncodedJwt, configClient.jwksEndpoint);
				if (!payload) {
					this.logger.error("Failed to verify JWT", {
						messageCode: MessageCodes.FAILED_VERIFYING_JWT,
					});
					return unauthorizedResponse();
				}
			} else {
				this.logger.error("Incomplete Client Configuration", {
					messageCode: MessageCodes.MISSING_CONFIGURATION,
				});
				return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
			}
		} catch (error) {
			this.logger.error("Invalid request: Could not verify jwt", {
				error,
				messageCode: MessageCodes.UNEXPECTED_ERROR_VERIFYING_JWT,
			});
			return unauthorizedResponse();
		}

		const JwtErrors = this.validationHelper.isJwtValid(jwtPayload, requestBodyClientId, configClient.redirectUri, Constants.EXPECTED_CONTEXT);
		if (JwtErrors.length > 0) {
			this.logger.error(JwtErrors, {
				messageCode: MessageCodes.FAILED_VALIDATING_JWT,
			});
			return unauthorizedResponse();
		}

		const sessionId: string = randomUUID();
		this.logger.appendKeys({
			sessionId,
			govuk_signin_journey_id: jwtPayload.govuk_signin_journey_id as string,
		});
		try {
			if (await this.cicService.getSessionById(sessionId)) {
				this.logger.error("sessionId already exists in the database", {
					messageCode: MessageCodes.SESSION_ALREADY_EXISTS,
				});
				return GenericServerError;
			}
		} catch (error) {
			this.logger.error("Unexpected error accessing session table", {
				error,
				messageCode: MessageCodes.UNEXPECTED_ERROR_SESSION_EXISTS,
			});
			return GenericServerError;
		}

		const session: ISessionItem = {
			sessionId,
			clientId: jwtPayload.client_id,
			clientSessionId: jwtPayload.govuk_signin_journey_id as string,
			redirectUri: jwtPayload.redirect_uri,
			expiryDate: (Date.now() / 1000) + +this.authSessionTtlInSecs,
			createdDate: Date.now() / 1000,
			state: jwtPayload.state,
			subject: jwtPayload.sub ? jwtPayload.sub : "",
			persistentSessionId: jwtPayload.persistent_session_id, //Might not be used
			clientIpAddress,
			attemptCount: 0,
			authSessionState: "CIC_SESSION_CREATED",
			journey: jwtPayload.context ? Constants.NO_PHOTO_ID_JOURNEY : Constants.FACE_TO_FACE_JOURNEY,
		};

		try {
			await this.cicService.createAuthSession(session);
		} catch (error) {
			this.logger.error("Failed to create session in session table", {
				error,
				messageCode: MessageCodes.FAILED_CREATING_SESSION,
			});
			return GenericServerError;
		}

		if (jwtPayload.shared_claims) {
			try {
				await this.cicService.savePersonIdentity(jwtPayload.shared_claims, sessionId, session.expiryDate);
			} catch (error) {
				this.logger.error("Failed to create session in person identity table", {
					error,
					messageCode: MessageCodes.FAILED_SAVING_PERSON_IDENTITY,
				});
				return GenericServerError;
			}
		}

		try {
			await this.cicService.sendToTXMA(this.txmaQueueUrl, {
				event_name: "CIC_CRI_START",
				...buildCoreEventFields(session, this.issuer, session.clientIpAddress, absoluteTimeNow),
			});
		} catch (error) {
			this.logger.error("Auth session successfully created. Failed to send CIC_CRI_START event to TXMA", {
				error,
				messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
			});
		}

		return {
			statusCode: HttpCodesEnum.OK,
			headers: SECURITY_HEADERS,
			body: JSON.stringify({
				session_id: sessionId,
				state: jwtPayload.state,
				redirect_uri: jwtPayload.redirect_uri,
			}),
		};
	}
}
