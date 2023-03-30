"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRequestProcessor = void 0;
const Response_1 = require("../utils/Response");
const CicService_1 = require("./CicService");
const metrics_1 = require("@aws-lambda-powertools/metrics");
const AppError_1 = require("../utils/AppError");
const HttpCodesEnum_1 = require("../utils/HttpCodesEnum");
const DynamoDBFactory_1 = require("../utils/DynamoDBFactory");
const KmsJwtAdapter_1 = require("../utils/KmsJwtAdapter");
const DateTimeUtils_1 = require("../utils/DateTimeUtils");
const crypto_1 = require("crypto");
const TxmaEvent_1 = require("../utils/TxmaEvent");
const ValidationHelper_1 = require("../utils/ValidationHelper");
const SESSION_TABLE = process.env.SESSION_TABLE;
const CLIENT_CONFIG = process.env.CLIENT_CONFIG;
const ENCRYPTION_KEY_IDS = process.env.ENCRYPTION_KEY_IDS;
const AUTH_SESSION_TTL = process.env.AUTH_SESSION_TTL;
const ISSUER = process.env.ISSUER;
class SessionRequestProcessor {
    constructor(logger, metrics) {
        if (!SESSION_TABLE || !CLIENT_CONFIG || !ENCRYPTION_KEY_IDS || !AUTH_SESSION_TTL || !ISSUER) {
            logger.error("Environment variable SESSION_TABLE or CLIENT_CONFIG or ENCRYPTION_KEY_IDS or AUTH_SESSION_TTL is not configured");
            throw new AppError_1.AppError("Service incorrectly configured", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
        this.logger = logger;
        this.metrics = metrics;
        logger.debug("metrics is  " + JSON.stringify(this.metrics));
        this.metrics.addMetric("Called", metrics_1.MetricUnits.Count, 1);
        this.cicService = CicService_1.CicService.getInstance(SESSION_TABLE, this.logger, (0, DynamoDBFactory_1.createDynamoDbClient)());
        this.kmsDecryptor = new KmsJwtAdapter_1.KmsJwtAdapter(ENCRYPTION_KEY_IDS);
        this.validationHelper = new ValidationHelper_1.ValidationHelper();
    }
    static getInstance(logger, metrics) {
        if (!SessionRequestProcessor.instance) {
            SessionRequestProcessor.instance = new SessionRequestProcessor(logger, metrics);
        }
        return SessionRequestProcessor.instance;
    }
    async processRequest(event) {
        const deserialisedRequestBody = JSON.parse(event.body);
        const requestBodyClientId = deserialisedRequestBody.client_id;
        const clientIpAddress = event.headers["x-forwarded-for"];
        let configClient;
        if (CLIENT_CONFIG) {
            const config = JSON.parse(CLIENT_CONFIG);
            configClient = config.find(c => c.clientId === requestBodyClientId);
        }
        else {
            this.logger.error("MISSING_CLIENT_CONFIG");
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.BAD_REQUEST, "Missing client config");
        }
        let urlEncodedJwt;
        try {
            urlEncodedJwt = await this.kmsDecryptor.decrypt(deserialisedRequestBody.request);
        }
        catch (error) {
            this.logger.error("FAILED_DECRYPTING_JWE", { error });
            return (0, Response_1.unauthorizedResponse)("Invalid request: Request failed to be decrypted");
        }
        let parsedJwt;
        try {
            parsedJwt = this.kmsDecryptor.decode(urlEncodedJwt);
        }
        catch (error) {
            this.logger.error("FAILED_DECODING_JWT", { error });
            return (0, Response_1.unauthorizedResponse)("Invalid request: Rejected jwt");
        }
        const jwtPayload = parsedJwt.payload;
        try {
            if (configClient?.jwksEndpoint) {
                const payload = await this.kmsDecryptor.verifyWithJwks(urlEncodedJwt, configClient.jwksEndpoint);
                if (!payload) {
                    return (0, Response_1.unauthorizedResponse)("JWT verification failed");
                }
            }
            else {
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.BAD_REQUEST, "Missing client config");
            }
        }
        catch (error) {
            this.logger.debug("UNEXPECTED_ERROR_VERIFYING_JWT", { error });
            return (0, Response_1.unauthorizedResponse)("Invalid request: Could not verify jwt");
        }
        if (configClient) {
            const JwtErrors = this.validationHelper.isJwtValid(jwtPayload, requestBodyClientId, configClient.redirectUri);
            if (JwtErrors.length > 0) {
                this.logger.error(JwtErrors);
                return (0, Response_1.unauthorizedResponse)("JWT validation/verification failed");
            }
        }
        else {
            this.logger.error("Missing Client Config");
            return (0, Response_1.unauthorizedResponse)("JWT validation/verification failed");
        }
        const sessionId = (0, crypto_1.randomUUID)();
        try {
            if (await this.cicService.getSessionById(sessionId)) {
                this.logger.error("SESSION_ALREADY_EXISTS", { fieldName: "sessionId", value: sessionId, reason: "sessionId already exists in the database" });
                return Response_1.GenericServerError;
            }
        }
        catch (err) {
            this.logger.error("UNEXPECTED_ERROR_SESSION_EXISTS", { error: err });
            return Response_1.GenericServerError;
        }
        const session = {
            sessionId,
            clientId: jwtPayload.client_id,
            clientSessionId: jwtPayload.govuk_signin_journey_id,
            redirectUri: jwtPayload.redirect_uri,
            expiryDate: Date.now() + Number(AUTH_SESSION_TTL) * 1000,
            createdDate: Date.now(),
            state: jwtPayload.state,
            subject: jwtPayload.sub ? jwtPayload.sub : "",
            persistentSessionId: jwtPayload.persistent_session_id,
            clientIpAddress: clientIpAddress,
            attemptCount: 0,
            authSessionState: "CIC_SESSION_CREATED",
        };
        try {
            await this.cicService.createAuthSession(session);
        }
        catch (error) {
            this.logger.error("FAILED_CREATING_SESSION", { error });
            return Response_1.GenericServerError;
        }
        if (jwtPayload.shared_claims) {
            try {
                await this.cicService.savePersonIdentity(jwtPayload.shared_claims, sessionId, session.expiryDate);
            }
            catch (error) {
                this.logger.error("FAILED_SAVING_PERSON_IDENTITY", { error });
                return Response_1.GenericServerError;
            }
        }
        try {
            await this.cicService.sendToTXMA({
                event_name: "CIC_CRI_START",
                ...(0, TxmaEvent_1.buildCoreEventFields)(session, ISSUER, session.clientIpAddress, DateTimeUtils_1.absoluteTimeNow),
            });
        }
        catch (error) {
            this.logger.error("FAILED_TO_WRITE_TXMA", {
                session,
                issues: ISSUER,
                reason: "Auth session successfully created. Failed to send DCMAW_CRI_START event to TXMA",
                error,
            });
            return Response_1.GenericServerError;
        }
        return {
            statusCode: HttpCodesEnum_1.HttpCodesEnum.OK,
            headers: Response_1.SECURITY_HEADERS,
            body: JSON.stringify({
                session_id: sessionId,
                state: jwtPayload.state,
                redirect_uri: jwtPayload.redirect_uri,
            }),
        };
    }
}
exports.SessionRequestProcessor = SessionRequestProcessor;
