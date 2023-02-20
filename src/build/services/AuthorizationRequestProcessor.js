"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationRequestProcessor = void 0;
const Response_1 = require("../utils/Response");
const CicService_1 = require("./CicService");
const metrics_1 = require("@aws-lambda-powertools/metrics");
const crypto_1 = require("crypto");
const ValidationHelper_1 = require("../utils/ValidationHelper");
const AppError_1 = require("../utils/AppError");
const HttpCodesEnum_1 = require("../utils/HttpCodesEnum");
const DateTimeUtils_1 = require("../utils/DateTimeUtils");
const DynamoDBFactory_1 = require("../utils/DynamoDBFactory");
const AuthSessionState_1 = require("../models/enums/AuthSessionState");
const TxmaEvent_1 = require("../utils/TxmaEvent");
const SESSION_TABLE = process.env.SESSION_TABLE;
const TXMA_QUEUE_URL = process.env.TXMA_QUEUE_URL;
const ISSUER = process.env.ISSUER;
class AuthorizationRequestProcessor {
    constructor(logger, metrics) {
        if (!SESSION_TABLE || !TXMA_QUEUE_URL || !ISSUER) {
            logger.error("Environment variable SESSION_TABLE or TXMA_QUEUE_URL or ISSUER is not configured");
            throw new AppError_1.AppError("Service incorrectly configured", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
        this.logger = logger;
        this.validationHelper = new ValidationHelper_1.ValidationHelper();
        this.metrics = metrics;
        this.cicService = CicService_1.CicService.getInstance(SESSION_TABLE, this.logger, (0, DynamoDBFactory_1.createDynamoDbClient)());
    }
    static getInstance(logger, metrics) {
        if (!AuthorizationRequestProcessor.instance) {
            AuthorizationRequestProcessor.instance = new AuthorizationRequestProcessor(logger, metrics);
        }
        return AuthorizationRequestProcessor.instance;
    }
    async processRequest(event, sessionId) {
        const session = await this.cicService.getSessionById(sessionId);
        if (session != null) {
            if (session.expiryDate < (0, DateTimeUtils_1.absoluteTimeNow)()) {
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `Session with session id: ${sessionId} has expired`);
            }
            this.logger.info({ message: "found session", session });
            this.metrics.addMetric("found session", metrics_1.MetricUnits.Count, 1);
            if (session.authSessionState !== AuthSessionState_1.AuthSessionState.CIC_DATA_RECEIVED) {
                this.logger.warn(`Session is in the wrong state: ${session.authSessionState}, expected state should be ${AuthSessionState_1.AuthSessionState.CIC_DATA_RECEIVED}`);
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `Session is in the wrong state: ${session.authSessionState}`);
            }
            const authorizationCode = (0, crypto_1.randomUUID)();
            await this.cicService.setAuthorizationCode(sessionId, authorizationCode);
            this.metrics.addMetric("Set authorization code", metrics_1.MetricUnits.Count, 1);
            try {
                await this.cicService.sendToTXMA({
                    event_name: "CIC_CRI_AUTH_CODE_ISSUED",
                    ...(0, TxmaEvent_1.buildCoreEventFields)(session, ISSUER, session.clientIpAddress, DateTimeUtils_1.absoluteTimeNow),
                });
            }
            catch (error) {
                this.logger.error("Failed to write TXMA event CIC_CRI_AUTH_CODE_ISSUED to SQS queue.");
            }
            const cicResp = {
                authorizationCode: {
                    value: authorizationCode,
                },
                redirect_uri: session?.redirectUri,
                state: session?.state,
            };
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.OK, JSON.stringify(cicResp));
        }
        else {
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
        }
    }
}
exports.AuthorizationRequestProcessor = AuthorizationRequestProcessor;
