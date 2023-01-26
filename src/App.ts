import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { StatusCodes } from "http-status-codes";
import { RequestProcessor } from "./services/RequestProcessor";
import { ResourcesEnum } from "./models/enums/ResourcesEnum";
import { AppError } from "./utils/AppError";

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CIC",
});
const metrics = new Metrics({ namespace: "CIC" });

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	switch (event.resource) {
		case ResourcesEnum.CLAIMEDIDENTITY:
			if (event.httpMethod === "POST") {
				try {
					logger.debug("Body is " + event.body);
					const sessionId = event.headers.session_id as string;
					if (!event.headers || !sessionId) {
						return new Response(StatusCodes.BAD_REQUEST, "Missing header: session_id is required");
					}

					if (event.body) {
						return await RequestProcessor.getInstance(logger, metrics).processRequest(event, sessionId);
					} else {
						return new Response(StatusCodes.BAD_REQUEST, "Empty payload");
					}

					// if (bodyParsed) {
					// SessionItem session = sessionService.validateSessionId(sessionId);
					// eventProbe.log(Level.INFO, "found session");

					// Save our addresses to the address table
					// c.saveAddresses(UUID.fromString(sessionId), addresses);

					// Now we've saved our address, we need to create an authorization code for the
					// session
					// sessionService.createAuthorizationCode(session);

					// eventProbe.counterMetric(LAMBDA_NAME);
					// return ApiGatewayResponseGenerator.proxyJsonResponse(HttpStatusCode.NO_CONTENT, "");
					// }

					// If we don't have at least one address, do not save
					// return ApiGatewayResponseGenerator.proxyJsonResponse(HttpStatusCode.OK, "");
				} catch (err) {
					logger.error("An error has occurred. " + err);
					return new Response(StatusCodes.INTERNAL_SERVER_ERROR, "An error has occurred");
				}
			}
			return new Response(StatusCodes.NOT_FOUND, "");

		case ResourcesEnum.USERINFO:
			if (event.httpMethod === "POST") {
				logger.info("Got userinfo request");
				const queries = JSON.stringify(event.queryStringParameters);
				return {
					statusCode: 200,
					body: `Queries: ${queries}`,
				};
			}
			return new Response(StatusCodes.NOT_FOUND, "");

		default:
			throw new AppError(StatusCodes.NOT_FOUND, "Requested resource does not exist", { resource: event.resource });

	}

};
