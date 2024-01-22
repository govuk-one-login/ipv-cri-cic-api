import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { MessageCodes } from "./models/enums/MessageCodes";
import { SessionConfigRequestProcessor } from "./services/SessionConfigRequestProcessor";

const { POWERTOOLS_METRICS_NAMESPACE = Constants.CIC_METRICS_NAMESPACE, POWERTOOLS_LOG_LEVEL = Constants.DEBUG, POWERTOOLS_SERVICE_NAME = Constants.SESSION_CONFIG_LOGGER_SVC_NAME } = process.env;

export const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

export const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class SessionConfigHandler implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);
		try {
			logger.info("Received session-config request", { requestId: event.requestContext.requestId });

			if (event.headers) {
				const sessionId = event.headers[Constants.X_SESSION_ID];
				if (sessionId) {
					logger.appendKeys({ sessionId });

					if (!Constants.REGEX_UUID.test(sessionId)) {
						logger.error("Session id not not a valid uuid", { messageCode: MessageCodes.FAILED_VALIDATING_SESSION_ID });
						return new Response(HttpCodesEnum.BAD_REQUEST, "Session id must be a valid uuid");
					}

					return await SessionConfigRequestProcessor.getInstance(logger, metrics).processRequest(sessionId);
				} else {
					logger.error(`Missing header: ${Constants.X_SESSION_ID} is required`, { messageCode: MessageCodes.MISSING_HEADER });
					return new Response(HttpCodesEnum.BAD_REQUEST, `Missing header: ${Constants.X_SESSION_ID} is required`);
				}
			} else {
				logger.error("Empty headers", { messageCode: MessageCodes.MISSING_HEADER });
				return new Response(HttpCodesEnum.BAD_REQUEST, "Empty headers");
			}
		} catch (error: any) {
			logger.error({ message: "Error fetching journey type", error, messageCode: MessageCodes.SERVER_ERROR });
			return new Response(HttpCodesEnum.SERVER_ERROR, "Server Error");	
		}	
	}		
					
}
const handlerClass = new SessionConfigHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
