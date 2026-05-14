 
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { logger } from "@govuk-one-login/cri-logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { SessionRequestProcessor } from "./services/SessionRequestProcessor";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { MessageCodes } from "./models/enums/MessageCodes";
import { Constants } from "./utils/Constants";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : "CIC-CRI";
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.USERINFO_LOGGER_SVC_NAME;

export const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE, serviceName: POWERTOOLS_SERVICE_NAME });

class Session implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);

		try {
			logger.info("Received session request", { requestId: event.requestContext.requestId });
			return await SessionRequestProcessor.getInstance(metrics).processRequest(event);
		} catch (error: any) {
			logger.error("An error has occurred.", {
				messageCode: MessageCodes.SERVER_ERROR,
				error,
			});
			if (error instanceof AppError) {
				return Response(error.statusCode, error.message);
			}
			return Response(HttpCodesEnum.SERVER_ERROR, "Server Error");
		}			

	}

}
const handlerClass = new Session();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
