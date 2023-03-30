"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lambdaHandler = void 0;
const logger_1 = require("@aws-lambda-powertools/logger");
const metrics_1 = require("@aws-lambda-powertools/metrics");
const Response_1 = require("./utils/Response");
const ClaimedIdRequestProcessor_1 = require("./services/ClaimedIdRequestProcessor");
const ResourcesEnum_1 = require("./models/enums/ResourcesEnum");
const AppError_1 = require("./utils/AppError");
const HttpCodesEnum_1 = require("./utils/HttpCodesEnum");
const HttpVerbsEnum_1 = require("./utils/HttpVerbsEnum");
const Constants_1 = require("./utils/Constants");
const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants_1.Constants.CIC_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : Constants_1.Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants_1.Constants.CLAIMEDID_LOGGER_SVC_NAME;
const logger = new logger_1.Logger({
    logLevel: POWERTOOLS_LOG_LEVEL,
    serviceName: POWERTOOLS_SERVICE_NAME,
});
const metrics = new metrics_1.Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });
class ClaimedIdentity {
    async handler(event, context) {
        switch (event.resource) {
            case ResourcesEnum_1.ResourcesEnum.CLAIMEDIDENTITY:
                if (event.httpMethod === HttpVerbsEnum_1.HttpVerbsEnum.POST) {
                    let sessionId;
                    try {
                        logger.info("Event received", { event });
                        if (event.headers) {
                            sessionId = event.headers[Constants_1.Constants.X_SESSION_ID];
                            if (sessionId) {
                                logger.info({ message: "Session id", sessionId });
                                if (!Constants_1.Constants.REGEX_UUID.test(sessionId)) {
                                    return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.BAD_REQUEST, "Session id must be a valid uuid");
                                }
                            }
                            else {
                                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.BAD_REQUEST, "Missing header: x-govuk-signin-session-id is required");
                            }
                        }
                        else {
                            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.BAD_REQUEST, "Empty headers");
                        }
                        if (event.body) {
                            return await ClaimedIdRequestProcessor_1.ClaimedIdRequestProcessor.getInstance(logger, metrics).processRequest(event, sessionId);
                        }
                        else {
                            return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.BAD_REQUEST, "Empty payload");
                        }
                    }
                    catch (err) {
                        logger.error({ message: "An error has occurred.", err });
                        if (err instanceof AppError_1.AppError) {
                            return new Response_1.Response(err.statusCode, err.message);
                        }
                        return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR, "An error has occurred");
                    }
                }
                return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND, "");
            default:
                throw new AppError_1.AppError("Requested resource does not exist" + { resource: event.resource }, HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND);
        }
    }
}
__decorate([
    metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
], ClaimedIdentity.prototype, "handler", null);
const handlerClass = new ClaimedIdentity();
exports.lambdaHandler = handlerClass.handler.bind(handlerClass);
