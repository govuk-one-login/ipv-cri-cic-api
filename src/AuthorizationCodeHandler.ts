 
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { AuthorizationRequestProcessor } from "./services/AuthorizationRequestProcessor";
import { MessageCodes } from "./models/enums/MessageCodes";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.CIC_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.AUTHORIZATION_LOGGER_SVC_NAME;

export const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

export const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class AuthorizationCodeHandler implements LambdaInterface {

	 
	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);
				
		
		let sessionId;
		try {
			logger.info("Received authorization request", { requestId: event.requestContext.requestId });

			if (event.headers) {
				sessionId = event.headers[Constants.SESSION_ID];
				if (sessionId) {
					logger.appendKeys({ sessionId });

					if (!Constants.REGEX_UUID.test(sessionId)) {
						logger.error("Session id not not a valid uuid", { messageCode: MessageCodes.FAILED_VALIDATING_SESSION_ID });
						return Response(HttpCodesEnum.BAD_REQUEST, "Session id must be a valid uuid");
					}
				} else {
					logger.error("Missing header: session-id is required", { messageCode: MessageCodes.MISSING_HEADER });
					return Response(HttpCodesEnum.BAD_REQUEST, "Missing header: session-id is required");
				}
			} else {
				logger.error("Empty headers", { messageCode: MessageCodes.MISSING_HEADER });
				return Response(HttpCodesEnum.BAD_REQUEST, "Empty headers");
			}
			return await AuthorizationRequestProcessor.getInstance(logger, metrics).processRequest(event, sessionId);
		} catch (error: any) {
			logger.error({ message: "An error has occurred.", error, messageCode: MessageCodes.SERVER_ERROR });
			if (error instanceof  AppError) {
				return Response(error.statusCode, error.message);
			}
			return Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
		}							
	}
}
const handlerClass = new AuthorizationCodeHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
