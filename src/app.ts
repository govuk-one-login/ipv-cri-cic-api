import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaInterface } from "@aws-lambda-powertools/commons";

class AccessTokenLambda implements LambdaInterface {
	 handler(event: APIGatewayProxyEvent, context: any): APIGatewayProxyResult {
		console.log("Hello world!");
		return {
			statusCode: 200,
			body: "Hello world",
		};
	}
}

const handlerClass = new AccessTokenLambda();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);
