import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { CicService } from "./CicService";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Response } from "../utils/Response";
import { AccessTokenRequestValidationHelper } from "../utils/AccessTokenRequestValidationHelper";
import { ISessionItem } from "../models/ISessionItem";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { Constants, EnvironmentVariables } from "../utils/Constants";
import { MessageCodes } from "../models/enums/MessageCodes";
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";
import { Jwt } from "../utils/IVeriCredential";
import { AuthSessionState } from "../models/enums/AuthSessionState";

interface ClientConfig {
	jwksEndpoint: string;
	clientId: string;
}

export class AccessTokenRequestProcessor {
    private static instance: AccessTokenRequestProcessor;

    private readonly logger: Logger;

    private readonly metrics: Metrics;

    private readonly accessTokenRequestValidationHelper: AccessTokenRequestValidationHelper;

    private readonly cicService: CicService;

    private readonly kmsJwtAdapter: KmsJwtAdapter;
  
    private readonly issuer: string;

	private readonly clientConfig: string;

    constructor(logger: Logger, metrics: Metrics) {
    	const sessionTableName: string = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE, logger);
  		const signingKeyArn: string = checkEnvironmentVariable(EnvironmentVariables.KMS_KEY_ARN, logger);
    	this.issuer = checkEnvironmentVariable(EnvironmentVariables.ISSUER, logger);
    	this.logger = logger;
    	this.kmsJwtAdapter = new KmsJwtAdapter(signingKeyArn, logger);
    	this.accessTokenRequestValidationHelper = new AccessTokenRequestValidationHelper();
    	this.metrics = metrics;
    	this.cicService = CicService.getInstance(sessionTableName, this.logger, createDynamoDbClient());
		this.clientConfig = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE, logger);
    }

    static getInstance(logger: Logger, metrics: Metrics): AccessTokenRequestProcessor {

    	if (!AccessTokenRequestProcessor.instance) {
    		AccessTokenRequestProcessor.instance = new AccessTokenRequestProcessor(logger, metrics);
    	}
    	return AccessTokenRequestProcessor.instance;
    }

    async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
    	try {
    		const requestPayload = this.accessTokenRequestValidationHelper.validatePayload(event.body);
    		let session :ISessionItem | undefined;
    		try {
    			session = await this.cicService.getSessionByAuthorizationCode(requestPayload.code);
    			if (!session) {
    				this.logger.error("No session found", {
    					messageCode: MessageCodes.SESSION_NOT_FOUND,
    				});
    				return new Response(HttpCodesEnum.UNAUTHORIZED, `No session found by authorization code: ${requestPayload.code}`);
    			}
    			this.logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });
    			this.logger.appendKeys({ sessionId: session.sessionId });
    		} catch (error) {
    			this.logger.error("Error while retrieving the session", {
    				messageCode: MessageCodes.SESSION_NOT_FOUND,
    				error,
    			});
    			if (error instanceof AppError) {
    				return new Response(error.statusCode, error.message);
    			}
    			return new Response(HttpCodesEnum.UNAUTHORIZED, "Error while retrieving the session");
    		}

			let configClient: ClientConfig | undefined;
				
				try {
					const config = JSON.parse(this.clientConfig) as ClientConfig[];
					configClient = config.find(c => c.clientId === session?.clientId);
				} catch (error: any) {
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

			if (session.authSessionState === AuthSessionState.CIC_AUTH_CODE_ISSUED) {
				const jwt: string = requestPayload.client_assertion;
				console.log("JWT", jwt);

				let parsedJwt: Jwt;
				try {
					parsedJwt = this.kmsJwtAdapter.decode(jwt);
				} catch (error: any) {
					this.logger.error("Failed to decode supplied JWT", {
						error,
						messageCode: MessageCodes.FAILED_DECODING_JWT,
					});
					return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
				}

				console.log("ParsedJWT", parsedJwt);

				try {
					if (configClient.jwksEndpoint) {
						const payload = await this.kmsJwtAdapter.verifyWithJwks(jwt, configClient.jwksEndpoint, parsedJwt.header.kid);

						if (!payload) {
							this.logger.error("Failed to verify JWT", {
								messageCode: MessageCodes.FAILED_VERIFYING_JWT,
							});
							return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
						}
					} else {
						this.logger.error("Incomplete Client Configuration", {
							messageCode: MessageCodes.MISSING_CONFIGURATION,
						});
						return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
					}
				} catch (error: any) {
					this.logger.error("Invalid request: Could not verify JWT", {
						error,
						messageCode: MessageCodes.FAILED_VERIFYING_JWT,
					});
					return new Response(HttpCodesEnum.UNAUTHORIZED, "Unauthorized");
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
    			const dns_suffix = checkEnvironmentVariable(EnvironmentVariables.DNS_SUFFIX, this.logger);
    			accessToken = await this.kmsJwtAdapter.sign(jwtPayload, dns_suffix);
    		} catch (error) {
    			this.logger.error("Failed to sign the accessToken Jwt", {
    				messageCode: MessageCodes.FAILED_SIGNING_JWT,
    				error,
    			});
    			return new Response( HttpCodesEnum.SERVER_ERROR, "Failed to sign the accessToken Jwt" );
    		}

    		// Update the sessionTable with accessTokenExpiryDate and AuthSessionState.
    		await this.cicService.updateSessionWithAccessTokenDetails(session.sessionId, jwtPayload.exp);

    		this.logger.info({ message: "Access token generated successfully" });

    		return {
    			statusCode: HttpCodesEnum.OK,
    			body: JSON.stringify({
    				access_token: accessToken,
    				token_type: Constants.BEARER,
    				expires_in: Constants.TOKEN_EXPIRY_SECONDS,
    			}),
    		};
		} else {
			this.logger.warn(`Session for journey ${session?.clientSessionId} is in the wrong Auth state: expected state - ${AuthSessionState.CIC_AUTH_CODE_ISSUED}, actual state - ${session.authSessionState}`, { messageCode: MessageCodes.INCORRECT_SESSION_STATE });
			return new Response(HttpCodesEnum.UNAUTHORIZED, `Session for journey ${session?.clientSessionId} is in the wrong Auth state: expected state - ${AuthSessionState.CIC_AUTH_CODE_ISSUED}, actual state - ${session.authSessionState}`);
		}
    	} catch (error: any) {
    		this.logger.error({ message: "Error while trying to create access token ", error, messageCode: MessageCodes.FAILED_CREATING_ACCESS_TOKEN });
    		return new Response(error.statusCode, error.message);
    	}
    }
}
