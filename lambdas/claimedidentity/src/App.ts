import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { CicService } from "./services/CicService";
import { CicSession } from "./models/CicSession";
import { validateModel } from "./aws/ValidationHelper"
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Response } from "./aws/Response";
import { StatusCodes }from 'http-status-codes';
import { randomUUID } from 'crypto'

const logger = new Logger({
    logLevel: 'DEBUG',
    serviceName: 'CIC'
});
const metrics = new Metrics({ namespace: 'CIC' });

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    let response: APIGatewayProxyResult;
    try {
        logger.debug("Body is "+event.body as string)
        const bodyParsed = JSON.parse(event.body as string);
        const sessionId = event.headers["session_id"] as string;
        if (!sessionId) {
            return new Response(StatusCodes.BAD_REQUEST,"Missing header: session_id is required");
        }

        let cicSession: CicSession
        if (bodyParsed) {
            try {
                cicSession = new CicSession(bodyParsed);
                await validateModel(cicSession);
                logger.debug("CIC Session is   *****"+JSON.stringify(cicSession));
            } catch (error){
                return new Response(StatusCodes.BAD_REQUEST,"Missing mandatory fields in the request payload");
            }

            const cicService = new CicService(process.env.SESSION_TABLE_NAME, logger);
            const session = await cicService.getSessionById(sessionId);

            if(session){
                logger.info('found session', JSON.stringify(session));
                metrics.addMetric('found session', MetricUnits.Count, 1);
                logger.debug("Session is   *****"+JSON.stringify(session));
                await cicService.saveCICData(sessionId, cicSession);
                const authCode = randomUUID();
                await cicService.createAuthorizationCode(sessionId, authCode)
                const resp = {
                    authorizationCode: authCode,
                    redirectUri: session?.redirectUri,
                    state: session?.state
                }
                return new Response(StatusCodes.NO_CONTENT,JSON.stringify(resp));
            } else{
                return new Response(StatusCodes.NOT_FOUND,`No session found with the session id: ${sessionId}`);
            }


        }else {
            return new Response(StatusCodes.BAD_REQUEST,"Empty payload");
        }

        //if (bodyParsed) {
        //SessionItem session = sessionService.validateSessionId(sessionId);
        //eventProbe.log(Level.INFO, "found session");

        // Save our addresses to the address table
        //c.saveAddresses(UUID.fromString(sessionId), addresses);

        // Now we've saved our address, we need to create an authorization code for the
        // session
        //sessionService.createAuthorizationCode(session);

        //eventProbe.counterMetric(LAMBDA_NAME);
        // return ApiGatewayResponseGenerator.proxyJsonResponse(HttpStatusCode.NO_CONTENT, "");
        //}

        // If we don't have at least one address, do not save
        //return ApiGatewayResponseGenerator.proxyJsonResponse(HttpStatusCode.OK, "");
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


