"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimedIdRequestProcessor = void 0;
const CicSession_1 = require("../models/CicSession");
const Response_1 = require("../utils/Response");
const CicService_1 = require("./CicService");
const metrics_1 = require("@aws-lambda-powertools/metrics");
const ValidationHelper_1 = require("../utils/ValidationHelper");
const AppError_1 = require("../utils/AppError");
const HttpCodesEnum_1 = require("../utils/HttpCodesEnum");
const DateTimeUtils_1 = require("../utils/DateTimeUtils");
const DynamoDBFactory_1 = require("../utils/DynamoDBFactory");
const AuthSessionState_1 = require("../models/enums/AuthSessionState");
const SESSION_TABLE = process.env.SESSION_TABLE;
class ClaimedIdRequestProcessor {
    constructor(logger, metrics) {
        if (!SESSION_TABLE) {
            logger.error("Environment variable SESSION_TABLE is not configured");
            throw new AppError_1.AppError("Service incorrectly configured", 500);
        }
        this.logger = logger;
        this.validationHelper = new ValidationHelper_1.ValidationHelper();
        this.metrics = metrics;
        this.cicService = CicService_1.CicService.getInstance(SESSION_TABLE, this.logger, (0, DynamoDBFactory_1.createDynamoDbClient)());
    }
    static getInstance(logger, metrics) {
        if (!ClaimedIdRequestProcessor.instance) {
            ClaimedIdRequestProcessor.instance = new ClaimedIdRequestProcessor(logger, metrics);
        }
        return ClaimedIdRequestProcessor.instance;
    }
    async processRequest(event, sessionId) {
        let cicSession;
        try {
            this.logger.debug("IN processRequest");
            const bodyParsed = JSON.parse(event.body);
            // Convert given_names and family_names string into string[]
            bodyParsed.given_names = bodyParsed.given_names.split(" ");
            bodyParsed.family_names = bodyParsed.family_names.split(" ");
            cicSession = new CicSession_1.CicSession(bodyParsed);
            await this.validationHelper.validateModel(cicSession, this.logger);
            this.logger.debug({ message: "CIC Session is", cicSession });
        }
        catch (error) {
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.BAD_REQUEST, "Missing mandatory fields in the request payload");
        }
        const session = await this.cicService.getSessionById(sessionId);
        if (session != null) {
            if (session.expiryDate < (0, DateTimeUtils_1.absoluteTimeNow)()) {
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `Session with session id: ${sessionId} has expired`);
            }
            this.logger.info({ message: "found session", session });
            this.metrics.addMetric("Found session", metrics_1.MetricUnits.Count, 1);
            if (session.authSessionState !== AuthSessionState_1.AuthSessionState.CIC_SESSION_CREATED) {
                this.logger.warn(`Session is in the wrong state: ${session.authSessionState}, expected state should be ${AuthSessionState_1.AuthSessionState.CIC_SESSION_CREATED}`);
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `Session is in the wrong state: ${session.authSessionState}`);
            }
            await this.cicService.saveCICData(sessionId, cicSession);
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.OK, "");
        }
        else {
            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
        }
    }
}
exports.ClaimedIdRequestProcessor = ClaimedIdRequestProcessor;
