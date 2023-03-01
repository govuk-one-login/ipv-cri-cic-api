import { Response, GenericServerError, UnauthorizedResponse, SuccessSessionResponse, UnauthorizedResponseWithRedirect, SECURITY_HEADERS } from "../utils/Response";
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
import { JwksPublicKeyGetter } from "../utils/PublicKeyGetter";
import { JwksJwtAdapter } from "../utils/JwksJwtAdapter";
import axios from 'axios'
import {ISessionItem} from "../models/ISessionItem";
import {buildCoreEventFields} from "../utils/TxmaEvent";
import {Jwks} from "../utils/IVeriCredential";


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

	private readonly cicService: CicService;

	private readonly kmsDecryptor: KmsJwtAdapter;

	private readonly jwksPublicKeyGetter: JwksPublicKeyGetter;

	private readonly jwksJwtAdapter: JwksJwtAdapter;

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
		this.metrics = metrics;

		logger.debug("metrics is  " + JSON.stringify(this.metrics));
		this.metrics.addMetric("Called", MetricUnits.Count, 1);
		this.cicService = CicService.getInstance(config.SESSION_TABLE, this.logger, createDynamoDbClient());
		this.kmsDecryptor = new KmsJwtAdapter(config.ENCRYPTION_KEY_IDS);
		this.jwksPublicKeyGetter = new JwksPublicKeyGetter(new URL('https://viveak-test-bucket.s3.eu-west-2.amazonaws.com/viveak-encryption-key-pub.json?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEOL%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMiJHMEUCIQCOUmIdaW%2BeaSxI62YMvXkJc9WGQIv%2FiZwWo1pbqBz%2FHwIgYTRgRQD7neIBnOUkhLCrgOsf16CkPnRc4qPalZ3i8tEq9AIIi%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgwwNjAxMTM0MDUyNDkiDCiszdzCAGjrtdZMsirIArZFrJ8a2ls8pCbW5UvzcmKO3HAWcUMa7%2FYDprsBMJvbVYuxcYI7D7wBTtCzK9apcgRt6FLKZJA7NXNkUbcxdZbLOvB5Ij0k0xE%2FeQbIyb3DXNEDFb20EBK6nhyb681Y6Jp6i8qVCyOrbDzJwAdI2vgS02AQ3Dw63d9iUE%2FqJSLARSiY6T4h90rPE6NEfe%2BFhaxKCXsjtQP6YK07xTYnvptKkA%2BvUfofWaj%2BW%2B5kIydBo0yDN%2FSWu5Amk%2B1cuXs2ejXxy%2Bx76cWajfExTCl%2F8e30AGYBGmgRGBDZ0xNmX2GIjvoE4SrT0m5z9FSywRcwOFQBMkqDdBNIlcYwr0gNlKBvG%2BoZEi8xtLaFV9%2BrMzYsW2HdeS5HS%2FAKr5FP9oL0RqsYguveJOPvpCDI9cmaOlF903s2XZLWW4rS26oP2Ts%2BK33CeI0S9W4wyLP8nwY6hwLxqw5v08debp2e4K7ndMJ8BuRB68IYoN%2B0kXPy4%2By%2FprBSJMj1hANMRKDfMjXqJAaquOfxEGVwXnP7IGPSrOdJ3ePD0mfoOosgIUcDaVFxljPZJEPk9pSx5WjQuFx1Dj7mI6TpdqwYdANc0oRh%2FvgGT2z7jMtzOsdAfKgIwWttF1hptC8Fgp39zxkrX1n09cBzHL2j1FoVSb8DyIqwugsYE08GKz4NtXeGY9vkhRLoQJrun%2FjLRFWqeIb%2Fi20QNvRTaYEgcZX1lgPSmTXQ%2BmiqvhjaTRctoFraN2%2BNwkUBv2MhNHsn7Qtd02imm5a%2BMy%2BWyiDwSOKRYmI9gSFemFWWjOt5W3gpJQ%3D%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20230301T102119Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAQ37YJYVAWCNE274P%2F20230301%2Feu-west-2%2Fs3%2Faws4_request&X-Amz-Signature=02b749efefbb114c1c8e0ab6ffa7c88985edc19508a45a048bb2165618b98404'));
		this.jwksJwtAdapter = new JwksJwtAdapter(this.jwksPublicKeyGetter);
		//Currently using our own KMS Verify Signin key, once .well-known work is done this will need to be changed to use the public signing key from IPV Core
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionRequestProcessor {
		if (!SessionRequestProcessor.instance) {
			SessionRequestProcessor.instance = new SessionRequestProcessor(logger, metrics);
		}
		return SessionRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		const url = 'https://viveak-test-bucket.s3.eu-west-2.amazonaws.com/viveak-encryption-key-pub.json?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEOj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCWV1LXdlc3QtMiJIMEYCIQC%2FyS1n1PYM29OGCOp0ymxOxn9ZqUZAShBw%2Fe4P9HR%2F%2BwIhANLxxC6d6k2YyrCEi3Res4LYNYtWR2LNt3hjkJL23994KooDCJH%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMDYwMTEzNDA1MjQ5Igzquf6Pyb1alga595oq3gL6v3ze0sdTHTC8Ha%2BWqoPFB9wib30rry%2BYw7pAgR%2FvpV6LGOvDBCn1JeyXGseyH%2BzGOY%2FjP%2FXdYPnN72WRJ08aD1wCvp%2Fq4mu9wOXqEajcvqZc5ILkYZiG8ZNRnOoIt3W%2BEpqquNSFc9hXDYR8zXSC0HGErN8qv%2Bc%2FUn8RTqluVugbMYfITmaxMeL%2Bk%2B4viAokfs8966ixbWmoppDF77quLcuIr3XQDMp253%2BIBMzViWKtu%2BdiQ4p77PTKv7cUu%2FihzPZsLTgpqqjb%2B%2BlQw3UcS0%2Bj7F1jZNwoPHMnM%2FpWnTEKKBUVDgig16fzjOeYEzY1YWP1usXedh564FZ9Q1RctNIh2aWB9amtLSqfOFfGx6%2FLhLNzZw9FWrCFGNbbYxeelgDFtqz%2FQ17x33jfB3Xs%2BRCFk8A16QRpKfDKGPtasUBYqCEjuatoEETLXSlLw9vNyTlvAFDge1qKW%2FaRPTDA5P2fBjqGAjF28Ey774nlaYoxdmrz6VWxoAdYuvUsmZxJg1X3%2B3qsKO3UtRYs6Ne%2FD4ikYM9NzIPiqH4lWJNbUiCXpvYLhfiCQaYdJt8KOw3wJXvx3QGFApmky3NLhU2Yj08PeECL7XiW%2B%2F3UQUy9ucLBZb29pHhJiNGdohOA98SSm3ruolR79ygAVn1g7kgKwbQwlA9UHsoOD9EDNjchgptl8OBGVr7fXONuB4eG6AEFWLEFrNqASJWpw6NWpCULUYx%2BHNwK6ZajCq1TlvQBuHVEdq4esvFwYU9dGaZUv9xR0ohrNrmNpbtVmu5sJT2E04dbUTnnejjsBJRlwW%2BNAAZ2P0JQuNIL2JvJp3A%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20230301T155054Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAQ37YJYVAZSUY6E7Z%2F20230301%2Feu-west-2%2Fs3%2Faws4_request&X-Amz-Signature=7c7839c605075b813a9ba43a1a59ab9126a6e46ba9076f444595101041579adc'
		const oidcProviderJwks = (await axios.get(url)).data as Jwks
		console.log('oidcProviderJwks', oidcProviderJwks);
		const deserialisedRequestBody = JSON.parse(event.body as string);
		const requestBodyClientId = deserialisedRequestBody.client_id;
		const clientIpAddress = event.headers["x-forwarded-for"];

		//const configClient = JSON.parse(config.CLIENT_CONFIG).find(c => c.clientId === requestBodyClientId);;

		let urlEncodedJwt;
		try {
			urlEncodedJwt = await this.kmsDecryptor.decrypt(deserialisedRequestBody.request);
		} catch (error) {
			console.log("FAILED_DECRYPTING_JWE", { error });
			this.logger.debug("FAILED_DECRYPTING_JWE", { error });
		}

		let parsedJwt;
		try {
			parsedJwt = await this.kmsDecryptor.decode(urlEncodedJwt);
			console.log("parsedJwt", parsedJwt);
		} catch (error) {
			this.logger.debug("FAILED_DECODING_JWT", { error });
		}

		const jwtPayload = parsedJwt.payload;

		//Verify -- START
		const isValidJws = await this.kmsDecryptor.verify(urlEncodedJwt, "");
		console.log('isValidJws', isValidJws);
		//TODO: Throw error if not valid
		//Verify -- END

		const expectedRedirectUri = 'http://localhost:8085/callback';

		if (!isValidJws) {
			console.log("Invalid request: JWT validation/verification failed: JWT verification failure")
			// throw new SessionValidationError(
			// 		"Session Validation Exception",
			// 		"Invalid request: JWT validation/verification failed: JWT verification failure",
			// );
		} else if (!jwtPayload.shared_claims) {
			console.log("Invalid request: JWT validation/verification failed: JWT payload missing shared claims")
		} else if (jwtPayload.client_id !== requestBodyClientId) {
			console.log(`Invalid request: JWT validation/verification failed: Mismatched client_id in request body (${requestBodyClientId}) & jwt (${jwtPayload.client_id})`)
			// } else if (!expectedRedirectUri) {
			// 	console.log(`Invalid request: JWT validation/verification failed: Unable to retrieve redirect URI for client_id: ${requestBodyClientId}`)
		} else if (expectedRedirectUri !== jwtPayload.redirect_uri) {
			console.log(`Invalid request: JWT validation/verification failed: Redirect uri ${jwtPayload.redirect_uri} does not match configuration uri ${expectedRedirectUri}`)
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

		const session:ISessionItem = {
			sessionId: sessionId,
			authSessionState: "CIC_SESSION_CREATED",
			subject: jwtPayload.sub ?? "",
			redirectUri: jwtPayload.redirect_uri,
			//issuer: jwtPayload.iss ?? "",
			//timeToLive: absoluteTimeNow() + config.AUTH_SESSION_TTL,
			//issuedOn: Date.now(),
			state: jwtPayload.state,
			clientId: jwtPayload.client_id,
			clientSessionId: jwtPayload.govuk_signin_journey_id as string,
			clientIpAddress: clientIpAddress as string,
			expiryDate: Date.now() + config.AUTH_SESSION_TTL * 1000,
			authorizationCodeExpiryDate:0,
			authorizationCode: "",
			accessToken: "",
			accessTokenExpiryDate: 0,
			persistentSessionId:"",
			full_name:"",
			date_of_birth:"",
			date_of_expiry:"",
			document_selected:"",
			createdDate:0,
			attemptCount:0
		};

		try {
			await this.cicService.createAuthSession(session);
		} catch (error) {
			this.logger.error("FAILED_CREATING_SESSION", { error });
			return GenericServerError;
		}

		if (jwtPayload.shared_claims) {
			try {
				console.log("jwtPayload.shared_claim", jwtPayload.shared_claims);
				console.log("name", jwtPayload.shared_claims.name);
				console.log("birthDate", jwtPayload.shared_claims.birthDate);
				console.log("address", jwtPayload.shared_claims.address);
				await this.cicService.savePersonIdentity(jwtPayload.shared_claims, sessionId, session.expiryDate );
			} catch (error) {
				this.logger.error("FAILED_SAVING_PERSON_IDENTITY", { error });
				return GenericServerError;
			}
		}

		try {
			await this.cicService.sendToTXMA({
				event_name: "CIC_CRI_START",
				...buildCoreEventFields(session, config.ISSUER as string, session.clientIpAddress, absoluteTimeNow),

			});
			// await this.cicService.sendToTXMA(JSON.stringify({
			// 	event_name: "CIC_CRI_START",
			// 	...{
			// 		user: {
			// 			user_id: session.subjectIdentifier,
			// 			session_id: session.authSessionId,
			// 			govuk_signin_journey_id: session.clientSessionId,
			// 			ip_address: clientIpAddress,
			// 		},
			// 		client_id: session.clientId,
			// 		timestamp: absoluteTimeNow(),
			// 		component_id: config.ISSUER,
			// 	},
			// }));
		} catch (error) {
			this.logger.error("FAILED_TO_WRITE_TXMA", {
				session,
				issues: config.ISSUER,
				reason: "Auth session successfully created. Failed to send DCMAW_CRI_START event to TXMA",
				error,
			});
			return GenericServerError;
		}

		this.logger.info("COMPLETED");
		const responseBody = {
			session_id: sessionId,
			state: jwtPayload.state,
			redirect_uri: jwtPayload.redirect_uri,
		};
		return {
			statusCode: HttpCodesEnum.OK,
			headers: SECURITY_HEADERS,
			body: JSON.stringify(responseBody),
		};
	}
}
