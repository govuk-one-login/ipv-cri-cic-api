 
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "@govuk-one-login/cri-logger";
import { metrics } from "@govuk-one-login/cri-metrics";
import { Response } from "./utils/Response";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { UserInfoRequestProcessor } from "./services/UserInfoRequestProcessor";
import { LambdaInterface } from "@aws-lambda-powertools/commons/lib/esm/types";
import { Constants } from "./utils/Constants";
import { MessageCodes } from "./models/enums/MessageCodes";

class UserInfo implements LambdaInterface {

	@metrics.logMetrics({ throwOnEmptyMetrics: false, captureColdStartMetric: true })
	async handler(event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> {

		// clear logger state set by any previous invocation, and add lambda context for this invocation
		logger.resetKeys();
		logger.addContext(context);
		try {
			logger.info("Received userInfo request", { requestId: event.requestContext.requestId });
			return await UserInfoRequestProcessor.getInstance(metrics).processRequest(event);
		} catch (error: any) {
			logger.error({
				message: "An error has occurred when processing the request",
				error,
				messageCode: MessageCodes.SERVER_ERROR,
			});
			return Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
		}
				
	}
}
const handlerClass = new UserInfo();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
