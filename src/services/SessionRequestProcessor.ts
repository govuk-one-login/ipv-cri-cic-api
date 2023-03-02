import { Response, GenericServerError, unauthorizedResponse, SECURITY_HEADERS } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { KMSClient } from "@aws-sdk/client-kms";
import { fromEnv } from "@aws-sdk/credential-providers";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { randomUUID } from "crypto";
import { ISessionItem } from "../models/ISessionItem";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { ValidationHelper } from "../utils/ValidationHelper";
import { JwtPayload, Jwt } from "../utils/IVeriCredential";

interface ClientConfig {
	jwksEndpoint: string;
	clientId: string;
	redirectUri: string;
}

export const kmsClient = new KMSClient({ region: process.env.REGION, credentials: fromEnv() });
export class SessionRequestProcessor {
	private static instance: SessionRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly cicService: CicService;

	private readonly kmsDecryptor: KmsJwtAdapter;

	private readonly validationHelper: ValidationHelper;

	constructor(logger: Logger, metrics: Metrics) {
		if (!process.env.SESSION_TABLE) {
			logger.error("Environment variable SESSION_TABLE is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
		} else if (!process.env.CLIENT_CONFIG) {
			logger.error("Environment variable CLIENT_CONFIG is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
		} else if (!process.env.ENCRYPTION_KEY_IDS) {
			logger.error("Environment variable ENCRYPTION_KEY_IDS is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
		} else if (!process.env.AUTH_SESSION_TTL) {
			logger.error("Environment variable ENCRYPTION_KEY_IDS is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
		}

		this.logger = logger;
		this.metrics = metrics;

		logger.debug("metrics is  " + JSON.stringify(this.metrics));
		this.metrics.addMetric("Called", MetricUnits.Count, 1);
		this.cicService = CicService.getInstance(process.env.SESSION_TABLE, this.logger, createDynamoDbClient());
		this.kmsDecryptor = new KmsJwtAdapter(process.env.ENCRYPTION_KEY_IDS );
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
		console.log("Client id "+requestBodyClientId)
		const clientIpAddress = event.headers["x-forwarded-for"];

		let configClient;
		if (process.env.CLIENT_CONFIG) {
			const config = JSON.parse(process.env.CLIENT_CONFIG) as ClientConfig[];
			configClient = config.find(c => c.clientId === requestBodyClientId);
		} else {
			return new Response(HttpCodesEnum.BAD_REQUEST, "Missing client config");
		}


		let urlEncodedJwt;
		try {
			urlEncodedJwt = await this.kmsDecryptor.decrypt(deserialisedRequestBody.request);
		} catch (error) {
			this.logger.error("FAILED_DECRYPTING_JWE", { error });
			return unauthorizedResponse("Invalid request: Request failed to be decrypted");
		}

		let parsedJwt: Jwt;
		try {
			parsedJwt = await this.kmsDecryptor.decode(urlEncodedJwt);
		} catch (error) {
			this.logger.error("FAILED_DECODING_JWT", { error });
			return unauthorizedResponse("Invalid request: Rejected jwt");
		}

		const jwtPayload : JwtPayload = parsedJwt.payload;
		try {
			const isValidJws = urlEncodedJwt ? await this.kmsDecryptor.verify(urlEncodedJwt) : false;
			if (!isValidJws) {
				this.logger.debug("FAILED_VERIFYING_JWT", {});
				// return unauthorizedResponse('Invalid request: Invalid signature')
			}
		} catch (error) {
			this.logger.debug("UNEXPECTED_ERROR_VERIFYING_JWT", { error });
			// return unauthorizedResponse('Invalid request: Could not verify jwt')
		}

		if (configClient) {
			const JwtErrors = this.validationHelper.isJwtValid(jwtPayload, requestBodyClientId, configClient.redirectUri);
			if (JwtErrors.length > 0) {
				this.logger.error(JwtErrors);
				return unauthorizedResponse("JWT validation/verification failed");
			}
		} else {
			this.logger.error("Missing Client Config");
			return unauthorizedResponse("JWT validation/verification failed");
		}


		const sessionId: string = randomUUID();
		try {
			if (await this.cicService.getSessionById(sessionId)) {
				this.logger.error("SESSION_ALREADY_EXISTS", { fieldName: "sessionId", value: sessionId, reason: "sessionId already exists in the database" });
				return GenericServerError;
			}
		} catch (err) {
			this.logger.error("UNEXPECTED_ERROR_SESSION_EXISTS", { error: err });
			return GenericServerError;
		}

		const session: ISessionItem = {
			sessionId,
			clientId: jwtPayload.client_id,
			clientSessionId: jwtPayload.govuk_signin_journey_id as string,
			redirectUri: jwtPayload.redirect_uri,
			expiryDate: Date.now() + Number(process.env.AUTH_SESSION_TTL) * 1000,
			createdDate: Date.now(),
			state: jwtPayload.state,
			subject: jwtPayload.sub ? jwtPayload.sub : "",
			persistentSessionId: jwtPayload.persistent_session_id, //Might not be used
			clientIpAddress: clientIpAddress as string,
			attemptCount: 0,
			authSessionState: "CIC_SESSION_CREATED",
		};

		try {
			await this.cicService.createAuthSession(session);
		} catch (error) {
			this.logger.error("FAILED_CREATING_SESSION", { error });
			return GenericServerError;
		}

		if (jwtPayload.shared_claims) {
			try {
				await this.cicService.savePersonIdentity(jwtPayload.shared_claims, sessionId, session.expiryDate);
			} catch (error) {
				this.logger.error("FAILED_SAVING_PERSON_IDENTITY", { error });
				return GenericServerError;
			}
		}

		try {
			await this.cicService.sendToTXMA(JSON.stringify({
				event_name: "CIC_CRI_START",
				...buildCoreEventFields(session, process.env.ISSUER as string, session.clientIpAddress, absoluteTimeNow),
			}));
		} catch (error) {
			this.logger.error("FAILED_TO_WRITE_TXMA", {
				session,
				issues: process.env.ISSUER,
				reason: "Auth session successfully created. Failed to send DCMAW_CRI_START event to TXMA",
				error,
			});
			return GenericServerError;
		}

		this.logger.info("COMPLETED");
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
