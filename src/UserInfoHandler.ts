import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { RequestProcessor } from "./services/RequestProcessor";
import { ResourcesEnum } from "./models/enums/ResourcesEnum";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import {UserInfoRequestProcessor} from "./services/UserInfoRequestProcessor";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE? process.env.POWERTOOLS_METRICS_NAMESPACE: "CIC-CRI"
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL? process.env.POWERTOOLS_LOG_LEVEL: "DEBUG"

const logger = new Logger({
    logLevel: POWERTOOLS_LOG_LEVEL,
    serviceName: "UserInfoHandler",
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE });

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    switch (event.resource) {

        case ResourcesEnum.USERINFO:
            if (event.httpMethod === "POST") {
                try{
                    logger.info("Got userinfo request");
                    return await UserInfoRequestProcessor.getInstance(logger, metrics).processRequest(event);

                } catch (err) {
                    logger.error("An error has occurred. " + err);
                    return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
                }
            }
            return new Response(HttpCodesEnum.NOT_FOUND, "");

        default:
            throw new AppError("Requested resource does not exist" + { resource: event.resource }, HttpCodesEnum.NOT_FOUND);

    }

};
