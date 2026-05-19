import { logger } from "@govuk-one-login/cri-logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { CicService } from "./CicService";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Response } from "../utils/Response";
import { AccessTokenRequestValidationHelper } from "../utils/AccessTokenRequestValidationHelper";
import { ISessionItem } from "../models/ISessionItem";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { Constants, EnvironmentVariables } from "../utils/Constants";
import { AuthSessionState } from "../models/enums/AuthSessionState";
import { MessageCodes } from "../models/enums/MessageCodes";
import { AppError } from "../utils/AppError";
import { Jwt } from "../utils/IVeriCredential";
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";

interface ClientConfig {
	jwksEndpoint: string;
	clientId: string;
}

export class AccessTokenRequestProcessor {
	private static instance: AccessTokenRequestProcessor;

	private readonly metrics: Metrics;

	private readonly accessTokenRequestValidationHelper: AccessTokenRequestValidationHelper;

    private readonly cicService: CicService;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	private readonly clientConfig: string;
	
	private readonly issuer: string;

    constructor(metrics: Metrics) {
    	const sessionTableName: string = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE);
  		const signingKeyArn: string = checkEnvironmentVariable(EnvironmentVariables.KMS_KEY_ARN);
    	
		this.issuer = checkEnvironmentVariable(EnvironmentVariables.ISSUER);
    	this.kmsJwtAdapter = new KmsJwtAdapter(signingKeyArn);
    	this.accessTokenRequestValidationHelper = new AccessTokenRequestValidationHelper();
    	this.metrics = metrics;
    	this.cicService = CicService.getInstance(sessionTableName, createDynamoDbClient());
		this.clientConfig = checkEnvironmentVariable(EnvironmentVariables.CLIENT_CONFIG);
    }

    static getInstance(metrics: Metrics): AccessTokenRequestProcessor {

    	if (!AccessTokenRequestProcessor.instance) {
    		AccessTokenRequestProcessor.instance = new AccessTokenRequestProcessor(metrics);
    	}
    	return AccessTokenRequestProcessor.instance;
    }

	async processRequest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
		try {
			let requestPayload;
			try {
				requestPayload = this.accessTokenRequestValidationHelper.validatePayload(event.body);
			} catch (error: any) {
				const statusCode = error instanceof AppError ? error.statusCode : HttpCodesEnum.UNAUTHORIZED;
				logger.error("Failed validating the Access token request body.", { messageCode: MessageCodes.FAILED_VALIDATING_ACCESS_TOKEN_REQUEST_BODY, error: error.message });
				return Response(statusCode, error.message);
			}

			let session: ISessionItem | undefined;

				session = await this.cicService.getSessionByAuthorizationCode(requestPayload.code);
				if (!session) {
					logger.info(`No session found by authorization code: : ${requestPayload.code}`, { messageCode: MessageCodes.SESSION_NOT_FOUND });
					return Response(HttpCodesEnum.UNAUTHORIZED, `No session found by authorization code: ${requestPayload.code}`);
				}
				logger.appendKeys({ sessionId: session.sessionId });
				logger.info({ message: "Found Session" });
				logger.appendKeys({
					govuk_signin_journey_id: session?.clientSessionId,
				});
				let configClient: ClientConfig | undefined;
				try {
					const config = JSON.parse(this.clientConfig) as ClientConfig[];
					configClient = config.find(c => c.clientId === session?.clientId);
				} catch (error: any) {
					logger.error("Invalid or missing client configuration table", {
						error,
						messageCode: MessageCodes.MISSING_CONFIGURATION,
					});
					return Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
				}
		
				if (!configClient) {
					logger.error("Unrecognised client in request", {
						messageCode: MessageCodes.UNRECOGNISED_CLIENT,
					});
					return Response(HttpCodesEnum.BAD_REQUEST, "Bad Request");
				}	

			if (session.authSessionState === AuthSessionState.CIC_AUTH_CODE_ISSUED) {
				const jwt: string = requestPayload.client_assertion;
				let parsedJwt: Jwt;
				try {
					parsedJwt = this.kmsJwtAdapter.decode(jwt);
				} catch (error: any) {
					logger.error("Failed to decode supplied JWT", {
						error,
						messageCode: MessageCodes.FAILED_DECODING_JWT,
					});
					return Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
				}

				try {
					if (configClient.jwksEndpoint) {
						const payload = await this.kmsJwtAdapter.verifyWithJwks(jwt, configClient.jwksEndpoint, parsedJwt.header.kid);

						if (!payload) {
							logger.error("Failed to verify JWT", {
								messageCode: MessageCodes.FAILED_VERIFYING_JWT,
							});
							return Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
						}
					} else {
						logger.error("Incomplete Client Configuration", {
							messageCode: MessageCodes.MISSING_CONFIGURATION,
						});
						return Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
					}
				} catch (error: any) {
					logger.error("Invalid request: Could not verify JWT", {
						error,
						messageCode: MessageCodes.FAILED_VERIFYING_JWT,
					});
					return Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
				}

				this.accessTokenRequestValidationHelper.validateTokenRequestToRecord(session, requestPayload.redirectUri);
				// Generate access token
				const jwtPayload = {
					sub: session.sessionId,
					aud: this.issuer,
					iss: this.issuer,
					exp: absoluteTimeNow() + Constants.TOKEN_EXPIRY_SECONDS,
				};
				let accessToken;
				try {
					const dns_suffix = checkEnvironmentVariable(EnvironmentVariables.DNS_SUFFIX);
					accessToken = await this.kmsJwtAdapter.sign(jwtPayload, dns_suffix);
				} catch (error) {
					logger.error("Failed to sign the accessToken Jwt", { messageCode: MessageCodes.FAILED_SIGNING_JWT });
					if (error instanceof AppError) {
						return Response(error.statusCode, error.message);
					}
					return Response(HttpCodesEnum.SERVER_ERROR, "Failed to sign the accessToken Jwt");
				}

				// Update the sessionTable with accessTokenExpiryDate and AuthSessionState.
				await this.cicService.updateSessionWithAccessTokenDetails(session.sessionId, jwtPayload.exp);

				logger.info({ message: "Access token generated successfully" });

				return {
					statusCode: HttpCodesEnum.OK,
					body: JSON.stringify({
						access_token: accessToken,
						token_type: Constants.BEARER,
						expires_in: Constants.TOKEN_EXPIRY_SECONDS,
					}),
				};
			} else {
				this.metrics.addMetric("AccessToken_error_user_state_incorrect", MetricUnit.Count, 1);
				logger.warn(`Session for journey ${session?.clientSessionId} is in the wrong Auth state: expected state - ${AuthSessionState.CIC_AUTH_CODE_ISSUED}, actual state - ${session.authSessionState}`, { messageCode: MessageCodes.INCORRECT_SESSION_STATE });
				return Response(HttpCodesEnum.UNAUTHORIZED, `Session for journey ${session?.clientSessionId} is in the wrong Auth state: expected state - ${AuthSessionState.CIC_AUTH_CODE_ISSUED}, actual state - ${session.authSessionState}`);
			}
		} catch (err: any) {
			const statusCode = err instanceof AppError ? err.statusCode : HttpCodesEnum.UNAUTHORIZED;
			logger.error({ message: "Error processing access token request", err });
			return Response(statusCode, err.message);
		}
    }
}
