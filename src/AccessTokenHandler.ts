 
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { logger } from "@govuk-one-login/cri-logger";
import { Constants } from "./utils/Constants";
import { Response } from "./utils/Response";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { AccessTokenRequestProcessor } from "./services/AccessTokenRequestProcessor";
import { MessageCodes } from "./models/enums/MessageCodes";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE ? process.env.POWERTOOLS_METRICS_NAMESPACE : Constants.CIC_METRICS_NAMESPACE;

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE });

export class AccessToken implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

		// clear PersistentLogAttributes set by any previous invocation, and add lambda context for this invocation
		logger.setPersistentLogAttributes({});
		logger.addContext(context);
		
		try {
			logger.info("Received token request", { requestId: event.requestContext.requestId });
			return await AccessTokenRequestProcessor.getInstance(metrics).processRequest(event);
		} catch (error: any) {
			logger.error({ message: "AccessTokenRequestProcessor encountered an error.",
				error,
				messageCode: MessageCodes.SERVER_ERROR,
			});
			return Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
		}				
	}
}
const handlerClass = new AccessToken();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
