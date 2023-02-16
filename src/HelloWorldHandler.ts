import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "UserInfoHandler",
});

export const lambdaHandler = (event: APIGatewayProxyEvent) => {
	logger.info("Hello World!");
};
