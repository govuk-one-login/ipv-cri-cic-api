import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { JweDecryptor } from "./security/jwe-decrypter";
import { KMSClient, GetPublicKeyCommand, GetPublicKeyCommandOutput } from "@aws-sdk/client-kms";
import { fromEnv } from "@aws-sdk/credential-providers";
import { JwtVerifier } from "./security/jwt-verifier";
import { jwtUtils } from "../utils/JwtUtils";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";

const config = {
	CLIENT_CONFIG: process.env.CLIENT_CONFIG,
	AUTH_SESSION_TTL: Number(process.env.AUTH_SESSION_TTL),
	ISSUER: process.env.ISSUER,
	SESSION_TABLE: process.env.SESSION_TABLE,
	KMS_KEY_ARN: process.env.KMS_KEY_ARN,
	ENCRYPTION_KEY_IDS: process.env.ENCRYPTION_KEY_IDS || "",
};

export const kmsClient = new KMSClient({ region: process.env.REGION, credentials: fromEnv() });
export class SessionRequestProcessor {
	private static instance: SessionRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly cicService: CicService;

	private readonly jweDecryptor: JweDecryptor;

	private readonly jwtVerifier: JwtVerifier;

	private readonly kmsAdapter: KmsJwtAdapter;


	constructor(logger: Logger, metrics: Metrics) {
		if (!config.SESSION_TABLE) {
			logger.error("Environment variable SESSION_TABLE is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR );
		}
		if (!config.KMS_KEY_ARN) {
			logger.error("Environment variable KMS_KEY_ARN is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR );
		}
		this.logger = logger;
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;

		logger.debug("metrics is  " + JSON.stringify(this.metrics));
		this.metrics.addMetric("Called", MetricUnits.Count, 1);
		this.cicService = CicService.getInstance(config.SESSION_TABLE, this.logger, createDynamoDbClient());
		this.jweDecryptor = new JweDecryptor();
		this.kmsAdapter = new KmsJwtAdapter(config.KMS_KEY_ARN);
		this.jwtVerifier = new JwtVerifier({
			jwtSigningAlgorithm: 'RSA-OAEP-256',
			publicSigningJwk: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEK1JjY55Zfjohl1TgKJ9uKJNZ9elFTNS1o3KVKviO2ZXFBGwLGGFyvhX3/UYheSbx4WqvxxES81eJR9yuSvOfpA==',
	}, this.logger );
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
		const clientIpAddress = event.headers["x-forwarded-for"];

		// const configClient = JSON.parse(config.CLIENT_CONFIG).find(c => c.clientId === requestBodyClientId);;

		//Decrypt -- START
		let urlEncodedJwt;
		try { 
			urlEncodedJwt = await this.jweDecryptor.decrypt(deserialisedRequestBody.request);
			console.log("urlEncodedJwt", urlEncodedJwt);
		} catch (error) {
			this.logger.debug("FAILED_DECRYPTING_JWE", { error });
		}
		//Decrypt -- END

		let parsedJwt;
		try {
			const [header, payload, signature] = urlEncodedJwt.split(".");
			parsedJwt = {
				header: JSON.parse(jwtUtils.base64DecodeToString(header)),
				payload: JSON.parse(jwtUtils.base64DecodeToString(payload)),
				signature,
			};
			console.log("parsedJwt", parsedJwt);
		} catch (error) {
			this.logger.debug("FAILED_DECODING_JWT", { error });
		}

		const jwtPayload = parsedJwt.payload

		const output : GetPublicKeyCommandOutput = await kmsClient.send(
				new GetPublicKeyCommand({
					KeyId: "63ca7025-70db-4265-8643-35aec68f3d0f"
				}))
		
		console.log('output', output);

		try {
			const isValidJws = await this.kmsAdapter.verify(urlEncodedJwt)
			if (!isValidJws) {
				this.logger.debug('FAILED_VERIFYING_JWT', {})
			}
		} catch (error) {
			console.log('UNEXPECTED_ERROR_VERIFYING_JWT', { error: error })
			this.logger.debug('UNEXPECTED_ERROR_VERIFYING_JWT', { error: error })
		}

		const sessionRequestSummary = {
					clientId: jwtPayload["client_id"] as string,
					clientIpAddress: clientIpAddress as string,
					clientSessionId: jwtPayload["govuk_signin_journey_id"] as string,
					persistentSessionId: jwtPayload["persistent_session_id"] as string,
					redirectUri: jwtPayload["redirect_uri"] as string,
					state: jwtPayload["state"] as string,
					subject: jwtPayload.sub as string,
					expiryDate: Date.now() + config.AUTH_SESSION_TTL * 1000,
		};
		console.log('sessionRequestSummary', sessionRequestSummary);
		
		const sessionId: string = await this.cicService.createAuthSession(sessionRequestSummary);
		console.log('sessionId', sessionId);

		return {
				statusCode: 201,
				body: JSON.stringify({
						session_id: sessionId,
						state: jwtPayload.state,
						redirect_uri: jwtPayload.redirect_uri,
				}),
		};
	}
}
