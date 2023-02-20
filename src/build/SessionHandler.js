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
const SessionRequestProcessor_1 = require("./services/SessionRequestProcessor");
const ResourcesEnum_1 = require("./models/enums/ResourcesEnum");
const AppError_1 = require("./utils/AppError");
const HttpCodesEnum_1 = require("./utils/HttpCodesEnum");
const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : "CIC-CRI";
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";
const logger = new logger_1.Logger({
    logLevel: POWERTOOLS_LOG_LEVEL,
    serviceName: "SessionHandler",
});
const metrics = new metrics_1.Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: "SessionHandler" });
class Session {
    async handler(event, context) {
        switch (event.resource) {
            case ResourcesEnum_1.ResourcesEnum.SESSION:
                try {
                    logger.debug("metrics is", { metrics });
                    logger.debug("Event received", { event });
                    return await SessionRequestProcessor_1.SessionRequestProcessor.getInstance(logger, metrics).processRequest(event);
                }
                catch (err) {
                    logger.error("An error has occurred. " + err);
                    if (err instanceof AppError_1.AppError) {
                        return new Response_1.Response(err.statusCode, err.message);
                    }
                    return new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR, "An error has occurred");
                }
            default:
                throw new AppError_1.AppError("Requested resource does not exist" + { resource: event.resource }, HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND);
        }
    }
}
__decorate([
    metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
], Session.prototype, "handler", null);
const handlerClass = new Session();
exports.lambdaHandler = handlerClass.handler.bind(handlerClass);
