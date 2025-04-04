 
 
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { ClaimedIdRequestProcessor } from "./services/ClaimedIdRequestProcessor";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { MessageCodes } from "./models/enums/MessageCodes";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.CIC_METRICS_NAMESPACE;
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : Constants.DEBUG;
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.CLAIMEDID_LOGGER_SVC_NAME;

const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class ClaimedIdentity implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);

		let sessionId;
		try {
			logger.info("Received claimed identity request", { requestId: event.requestContext.requestId });

			if (event.headers) {
				sessionId = event.headers[Constants.X_SESSION_ID];
				if (sessionId) {
					logger.appendKeys({ sessionId });

					if (!Constants.REGEX_UUID.test(sessionId)) {
						logger.error("Session id not not a valid uuid", { messageCode: MessageCodes.FAILED_VALIDATING_SESSION_ID });
						return new Response(HttpCodesEnum.BAD_REQUEST, "Session id must be a valid uuid");
					}
				} else {
					logger.error("Missing header: x-govuk-signin-session-id is required", { messageCode: MessageCodes.MISSING_HEADER });
					return new Response(HttpCodesEnum.BAD_REQUEST, "Missing header: x-govuk-signin-session-id is required");
				}
			} else {
				logger.error("Empty headers", { messageCode: MessageCodes.MISSING_HEADER });
				return new Response(HttpCodesEnum.BAD_REQUEST, "Empty headers");
			}

			if (event.body) {
				return await ClaimedIdRequestProcessor.getInstance(logger, metrics).processRequest(event, sessionId);
			} else {
				logger.error("Empty payload", { messageCode: MessageCodes.MISSING_PAYLOAD });
				return new Response(HttpCodesEnum.BAD_REQUEST, "Empty payload");
			}

		} catch (error: any) {
			logger.error({ message: "An error has occurred.", error, messageCode: MessageCodes.SERVER_ERROR });

			if (error instanceof AppError) {
				return new Response(error.statusCode, error.message);
			}
			return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
		}								

	}

}
const handlerClass = new ClaimedIdentity();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
