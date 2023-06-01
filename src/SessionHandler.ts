import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { SessionRequestProcessor } from "./services/SessionRequestProcessor";
import { ResourcesEnum } from "./models/enums/ResourcesEnum";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { MessageCodes } from "./models/enums/MessageCodes";
import { Constants } from "./utils/Constants";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : "CIC-CRI";
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.USERINFO_LOGGER_SVC_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE });

class Session implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	@logger.injectLambdaContext()
	async handler(event: APIGatewayProxyEvent, _context: any): Promise<APIGatewayProxyResult> {
		switch (event.resource) {
			case ResourcesEnum.SESSION:
				try {
					logger.debug("metrics is", { metrics });
					logger.debug("Event received", { event });
					return await SessionRequestProcessor.getInstance(logger, metrics).processRequest(event);
				} catch (error: any) {
					logger.error("An error has occurred.", {
						messageCode: MessageCodes.SERVER_ERROR,
						error,
					});
					if (error instanceof AppError) {
						return new Response(error.statusCode, error.message);
					}
					return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
				}
			default:
				logger.error("Requested resource does not exist", {
					resource: event.resource,
					messageCode: MessageCodes.RESOURCE_NOT_FOUND,
				});
				throw new AppError("Requested resource does not exist" + { resource: event.resource }, HttpCodesEnum.NOT_FOUND);
		}

	}

}
const handlerClass = new Session();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
