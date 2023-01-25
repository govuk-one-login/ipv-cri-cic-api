import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { StatusCodes } from "http-status-codes";
import { RequestProcessor } from "./services/RequestProcessor";

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CIC",
});
const metrics = new Metrics({ namespace: "CIC" });

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	let response: APIGatewayProxyResult;
	try {
		logger.debug("Body is " + event.body);
		const sessionId = event.headers.session_id as string;
		if (!sessionId) {
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
		// eslint-disable-next-line no-console
		console.error(err);
		response = {
			statusCode: 500,
			body: "An error has occurred. " + err,
		};
	}
	return response;
};
