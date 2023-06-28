import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { ResourcesEnum } from "./models/enums/ResourcesEnum";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { UserInfoRequestProcessor } from "./services/UserInfoRequestProcessor";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { MessageCodes } from "./models/enums/MessageCodes";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.CIC_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.USERINFO_LOGGER_SVC_NAME;
const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE });

class UserInfo implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);

		switch (event.resource) {
			case ResourcesEnum.USERINFO:
				if (event.httpMethod === "POST") {
					try {
						logger.info("Received userInfo request", { requestId: event.requestContext.requestId });
						return await UserInfoRequestProcessor.getInstance(logger, metrics).processRequest(event);
					} catch (error) {
						logger.error({
							message: "An error has occurred when processing the request",
							error,
							messageCode: MessageCodes.SERVER_ERROR,
						});
						return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
					}
				}
				return new Response(HttpCodesEnum.NOT_FOUND, "");

			default:
				logger.error("Requested resource does not exist", {
					resource: event.resource,
					messageCode: MessageCodes.RESOURCE_NOT_FOUND,
				});
				throw new AppError("Requested resource does not exist " + event.resource, HttpCodesEnum.NOT_FOUND);

		}
	}
}
const handlerClass = new UserInfo();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
