"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lambdaHandler = exports.AccessToken = void 0;
const metrics_1 = require("@aws-lambda-powertools/metrics");
const logger_1 = require("@aws-lambda-powertools/logger");
const Constants_1 = require("./utils/Constants");
const ResourcesEnum_1 = require("./models/enums/ResourcesEnum");
const Response_1 = require("./utils/Response");
const HttpCodesEnum_1 = require("./utils/HttpCodesEnum");
const AppError_1 = require("./utils/AppError");
const AccessTokenRequestProcessor_1 = require("./services/AccessTokenRequestProcessor");
const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants_1.Constants.CIC_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants_1.Constants.ACCESSTOKEN_LOGGER_SVC_NAME;
const logger = new logger_1.Logger({
    logLevel: POWERTOOLS_LOG_LEVEL,
    serviceName: POWERTOOLS_SERVICE_NAME,
});
const metrics = new metrics_1.Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE });
class AccessToken {
    async handler(event, context) {
        switch (event.resource) {
            case ResourcesEnum_1.ResourcesEnum.TOKEN:
                if (event.httpMethod === "POST") {
                    try {
                        logger.info("Got token request:", { event });
                        return await AccessTokenRequestProcessor_1.AccessTokenRequestProcessor.getInstance(logger, metrics).processRequest(event);
                    }
                    catch (err) {
                        logger.error({ message: "An error has occurred. ", err });
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
], AccessToken.prototype, "handler", null);
exports.AccessToken = AccessToken;
const handlerClass = new AccessToken();
exports.lambdaHandler = handlerClass.handler.bind(handlerClass);
