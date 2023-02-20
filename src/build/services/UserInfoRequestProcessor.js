"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInfoRequestProcessor = void 0;
const Response_1 = require("../utils/Response");
const CicService_1 = require("./CicService");
const metrics_1 = require("@aws-lambda-powertools/metrics");
const ValidationHelper_1 = require("../utils/ValidationHelper");
const AppError_1 = require("../utils/AppError");
const VerifiableCredentialService_1 = require("../utils/VerifiableCredentialService");
const DateTimeUtils_1 = require("../utils/DateTimeUtils");
const HttpCodesEnum_1 = require("../utils/HttpCodesEnum");
const DynamoDBFactory_1 = require("../utils/DynamoDBFactory");
const KmsJwtAdapter_1 = require("../utils/KmsJwtAdapter");
const AuthSessionState_1 = require("../models/enums/AuthSessionState");
const TxmaEvent_1 = require("../utils/TxmaEvent");
const SESSION_TABLE = process.env.SESSION_TABLE;
const KMS_KEY_ARN = process.env.KMS_KEY_ARN;
const ISSUER = process.env.ISSUER;
class UserInfoRequestProcessor {
    constructor(logger, metrics) {
        if (!SESSION_TABLE || !ISSUER || !KMS_KEY_ARN) {
            logger.error("Environment variable SESSION_TABLE or ISSUER or KMS_KEY_ARN is not configured");
            throw new AppError_1.AppError("Service incorrectly configured", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
        this.logger = logger;
        this.validationHelper = new ValidationHelper_1.ValidationHelper();
        this.metrics = metrics;
        this.cicService = CicService_1.CicService.getInstance(SESSION_TABLE, this.logger, (0, DynamoDBFactory_1.createDynamoDbClient)());
        this.kmsJwtAdapter = new KmsJwtAdapter_1.KmsJwtAdapter(KMS_KEY_ARN);
        this.verifiableCredentialService = VerifiableCredentialService_1.VerifiableCredentialService.getInstance(SESSION_TABLE, this.kmsJwtAdapter, ISSUER, this.logger);
    }
    static getInstance(logger, metrics) {
        if (!UserInfoRequestProcessor.instance) {
            UserInfoRequestProcessor.instance = new UserInfoRequestProcessor(logger, metrics);
        }
        return UserInfoRequestProcessor.instance;
    }
    async processRequest(event) {
        // Validate the Authentication header and retrieve the sub (sessionId) from the JWT token.
        let sub;
        try {
            sub = await this.validationHelper.eventToSubjectIdentifier(this.kmsJwtAdapter, event);
        }
        catch (error) {
            if (error instanceof AppError_1.AppError) {
                this.logger.error({ message: "Error validating Authentication Access token from headers: " + error.message });
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, "Failed to Validate - Authentication header: " + error.message);
            }
        }
        let session;
        try {
            session = await this.cicService.getSessionById(sub);
            this.logger.info({ message: "Found Session: " + JSON.stringify(session) });
            if (!session) {
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `No session found with the sessionId: ${sub}`);
            }
        }
        catch (err) {
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `No session found with the sessionId: ${sub}`);
        }
        this.metrics.addMetric("found session", metrics_1.MetricUnits.Count, 1);
        // Validate the AuthSessionState to be "CIC_ACCESS_TOKEN_ISSUED"
        if (session.authSessionState !== AuthSessionState_1.AuthSessionState.CIC_ACCESS_TOKEN_ISSUED) {
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `AuthSession is in wrong Auth state: Expected state- ${AuthSessionState_1.AuthSessionState.CIC_ACCESS_TOKEN_ISSUED}, actual state- ${session.authSessionState}`);
        }
        // Validate the User Info data presence required to generate the VC
        const isValidUserCredentials = this.validationHelper.validateUserInfo(session, this.logger);
        if (!isValidUserCredentials) {
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR, "Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
        }
        //Generate VC and create a signedVC as response back to IPV Core.
        let signedJWT;
        try {
            signedJWT = await this.verifiableCredentialService.generateSignedVerifiableCredentialJwt(session, DateTimeUtils_1.absoluteTimeNow);
        }
        catch (error) {
            if (error instanceof AppError_1.AppError) {
                this.logger.error({ message: "Error generating signed verifiable credential jwt: " + error.message });
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR, "Failed to sign the verifiableCredential Jwt");
            }
        }
        // Add metric and send TXMA event to the sqsqueue
        this.metrics.addMetric("Generated signed verifiable credential jwt", metrics_1.MetricUnits.Count, 1);
        try {
            await this.cicService.sendToTXMA({
                event_name: "CIC_CRI_VC_ISSUED",
                ...(0, TxmaEvent_1.buildCoreEventFields)(session, ISSUER, session.clientIpAddress, DateTimeUtils_1.absoluteTimeNow),
            });
        }
        catch (error) {
            this.logger.error("Failed to write TXMA event CIC_CRI_VC_ISSUED to SQS queue.");
        }
        return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.OK, JSON.stringify({
            sub: session.clientId,
            "https://vocab.account.gov.uk/v1/credentialJWT": [signedJWT],
        }));
    }
}
exports.UserInfoRequestProcessor = UserInfoRequestProcessor;
