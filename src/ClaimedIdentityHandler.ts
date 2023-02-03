import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Response } from "./utils/Response";
import { RequestProcessor } from "./services/RequestProcessor";
import { ResourcesEnum } from "./models/enums/ResourcesEnum";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";

const POWERTOOLS_METRICS_NAMESPACE = process.env.POWERTOOLS_METRICS_NAMESPACE? process.env.POWERTOOLS_METRICS_NAMESPACE: "CIC-CRI"
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL? process.env.POWERTOOLS_LOG_LEVEL: "DEBUG"

const logger = new Logger({
    logLevel: POWERTOOLS_LOG_LEVEL,
    serviceName: "ClaimedIdHandler",
});

const metrics = new Metrics({ namespace: POWERTOOLS_METRICS_NAMESPACE });

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    switch (event.resource) {
        case ResourcesEnum.CLAIMEDIDENTITY:
            if (event.httpMethod === "POST") {
                try {
                    logger.debug("metrics is",{metrics});
                    logger.debug("Event received",{event})
                    const sessionId = event.headers.session_id as string;
                    logger.debug("Session id", {sessionId});
                    if (!event.headers || !sessionId) {
                        return new Response(HttpCodesEnum.BAD_REQUEST, "Missing header: session_id is required");
                    }

                    if (event.body) {
                        return await RequestProcessor.getInstance(logger, metrics).processRequest(event, sessionId);
                    } else {
                        return new Response(HttpCodesEnum.BAD_REQUEST, "Empty payload");
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

                } catch (err: any) {
                    logger.error("An error has occurred. " + err);
                    if(err instanceof  AppError){
                        return new Response(err.statusCode,err.message);
                    }
                    return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
                }
            }
            return new Response(HttpCodesEnum.NOT_FOUND, "");

        default:
            throw new AppError("Requested resource does not exist" + { resource: event.resource }, HttpCodesEnum.NOT_FOUND);
    }

};
