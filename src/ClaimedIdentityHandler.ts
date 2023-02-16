import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { ClaimedIdRequestProcessor } from "./services/ClaimedIdRequestProcessor";
import { ResourcesEnum } from "./models/enums/ResourcesEnum";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { HttpVerbsEnum } from "./utils/HttpVerbsEnum";
import { Constants } from "./utils/Constants";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.CLAIMEDID_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : Constants.DEBUG;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: Constants.CLAIMEDID_LOGGER_SVC_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: Constants.CLAIMEDID_METRICS_SVC_NAME });

class ClaimedIdentity implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {
		switch (event.resource) {
			case ResourcesEnum.CLAIMEDIDENTITY:
				if (event.httpMethod === HttpVerbsEnum.POST) {
					let sessionId;
					try {
						logger.info("Event received", { event });
						if (event.headers) {
							sessionId = event.headers[Constants.SESSION_ID];
							logger.info({ message: "Session id", sessionId });
						} else {
							return new Response(HttpCodesEnum.BAD_REQUEST, "Empty headers");
						}

						if (sessionId) {
							if (event.body) {
								return await ClaimedIdRequestProcessor.getInstance(logger, metrics).processRequest(event, sessionId);
							} else {
								return new Response(HttpCodesEnum.BAD_REQUEST, "Empty payload");
							}
						} else {
							return new Response(HttpCodesEnum.BAD_REQUEST, "Missing header: x-govuk-signin-session-id is required");
						}

					} catch (err: any) {
						logger.error({ message: "An error has occurred.", err });
						if (err instanceof  AppError) {
							return new Response(err.statusCode, err.message);
						}
						return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
					}
				}
				return new Response(HttpCodesEnum.NOT_FOUND, "");

			default:
				throw new AppError("Requested resource does not exist" + { resource: event.resource }, HttpCodesEnum.NOT_FOUND);
		}

	}

}
const handlerClass = new ClaimedIdentity();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
