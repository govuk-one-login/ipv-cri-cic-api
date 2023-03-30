"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessTokenRequestProcessor = void 0;
const CicService_1 = require("./CicService");
const KmsJwtAdapter_1 = require("../utils/KmsJwtAdapter");
const AppError_1 = require("../utils/AppError");
const HttpCodesEnum_1 = require("../utils/HttpCodesEnum");
const DynamoDBFactory_1 = require("../utils/DynamoDBFactory");
const Response_1 = require("../utils/Response");
const AccessTokenRequestValidationHelper_1 = require("../utils/AccessTokenRequestValidationHelper");
const DateTimeUtils_1 = require("../utils/DateTimeUtils");
const Constants_1 = require("../utils/Constants");
const SESSION_TABLE = process.env.SESSION_TABLE;
const KMS_KEY_ARN = process.env.KMS_KEY_ARN;
const ISSUER = process.env.ISSUER;
class AccessTokenRequestProcessor {
    constructor(logger, metrics) {
        if (!SESSION_TABLE || !KMS_KEY_ARN || !ISSUER) {
            logger.error("Environment variable SESSION_TABLE or KMS_KEY_ARN or ISSUER is not configured");
            throw new AppError_1.AppError("Service incorrectly configured, missing some environment variables.", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
        this.logger = logger;
        this.kmsJwtAdapter = new KmsJwtAdapter_1.KmsJwtAdapter(KMS_KEY_ARN);
        this.accessTokenRequestValidationHelper = new AccessTokenRequestValidationHelper_1.AccessTokenRequestValidationHelper();
        this.metrics = metrics;
        this.cicService = CicService_1.CicService.getInstance(SESSION_TABLE, this.logger, (0, DynamoDBFactory_1.createDynamoDbClient)());
    }
    static getInstance(logger, metrics) {
        if (!AccessTokenRequestProcessor.instance) {
            AccessTokenRequestProcessor.instance = new AccessTokenRequestProcessor(logger, metrics);
        }
        return AccessTokenRequestProcessor.instance;
    }
    async processRequest(event) {
        try {
            const requestPayload = this.accessTokenRequestValidationHelper.validatePayload(event.body);
            let session;
            try {
                session = await this.cicService.getSessionByAuthorizationCode(requestPayload.code);
                this.logger.info({ message: "Found Session: " + JSON.stringify(session) });
                if (!session) {
                    return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `No session found by authorization code: ${requestPayload.code}`);
                }
            }
            catch (err) {
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, "Error while retrieving the session");
            }
            this.accessTokenRequestValidationHelper.validateTokenRequestToRecord(session, requestPayload.redirectUri);
            // Generate access token
            const jwtPayload = {
                sub: session.sessionId,
                aud: ISSUER,
                iss: ISSUER,
                exp: (0, DateTimeUtils_1.absoluteTimeNow)() + Constants_1.Constants.TOKEN_EXPIRY_SECONDS,
            };
            let accessToken;
            try {
                accessToken = await this.kmsJwtAdapter.sign(jwtPayload);
            }
            catch (error) {
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR, "Failed to sign the accessToken Jwt");
            }
            // Update the sessionTable with accessTokenExpiryDate and AuthSessionState.
            await this.cicService.updateSessionWithAccessTokenDetails(session.sessionId, jwtPayload.exp);
            this.logger.info({ message: "Access token generated successfully" });
            return {
                statusCode: HttpCodesEnum_1.HttpCodesEnum.CREATED,
                body: JSON.stringify({
                    access_token: accessToken,
                    token_type: Constants_1.Constants.BEARER,
                    expires_in: Constants_1.Constants.TOKEN_EXPIRY_SECONDS,
                }),
            };
        }
        catch (err) {
            return new Response_1.Response(err.statusCode, err.message);
        }
    }
}
exports.AccessTokenRequestProcessor = AccessTokenRequestProcessor;
