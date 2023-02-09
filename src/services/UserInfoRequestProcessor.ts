import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { AppError } from "../utils/AppError";
import {VerifiableCredentialService} from "../vendor/VerifiableCredentialService";
import {absoluteTimeNow} from "../utils/DateTimeUtils";
import {HttpCodesEnum} from "../utils/HttpCodesEnum";

const SESSION_TABLE = process.env.SESSION_TABLE;

export class UserInfoRequestProcessor {
    private static instance: UserInfoRequestProcessor;

    private readonly logger: Logger;

    private readonly metrics: Metrics;

    private readonly validationHelper: ValidationHelper;

    private readonly cicService: CicService;

    private readonly verifiableCredentialService: VerifiableCredentialService;

    constructor(logger: Logger, metrics: Metrics) {
        if (!SESSION_TABLE) {
            logger.error("Environment variable SESSION_TABLE is not configured");
            throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR, );
        }
        this.logger = logger;
        this.validationHelper = new ValidationHelper();
        this.metrics = metrics;
        this.cicService = CicService.getInstance(SESSION_TABLE, this.logger);
        this.verifiableCredentialService = VerifiableCredentialService.getInstance(SESSION_TABLE, this.logger);
    }

    static getInstance(logger: Logger, metrics: Metrics): UserInfoRequestProcessor {
        if (!UserInfoRequestProcessor.instance) {
            UserInfoRequestProcessor.instance = new UserInfoRequestProcessor(logger, metrics);
        }
        return UserInfoRequestProcessor.instance;
    }

    async processRequest(event: APIGatewayProxyEvent): Promise<Response> {

        // Extract the bearer token TODO- Needs to be tested with unit tests
        // By reference to access-token-handler.ts being build in common-lambdas library, i see that the /token endpoint would
        // verify the jwt token received from IPV core and once verified will issue a Bearer token which is a plain 32byte encoded code as response
        // Also by refering the code in different CRIs, looks like they only parse this Bearer token from the header to extract the userinfo from the session table.
        // Hence keeping the implementation as per this assumption.
        const isValidAccessToken = await this.validationHelper.validateAccessCode(event, this.logger);
        if(!isValidAccessToken){
            return new Response(HttpCodesEnum.BAD_REQUEST, "Missing header: Authorization header value is missing or invalid auth_scheme");
        }
        const token = event.headers["Authorization"] as string;
        const accessToken = token.split(' ')[1];
        this.logger.info("Bearer Access Token:" +accessToken)

        // This is the common lib code which is in Java, mocking code to get the SessionItem
        // const sessionItem = this.sessionService.getSessionByAccessToken(accessToken);
        let session;
        try{
            session = await this.cicService.getSessionByAccessToken(accessToken);
            if (!session) {
                return new Response(HttpCodesEnum.NOT_FOUND, `No session found with the accesstoken: ${accessToken}`);
            }
        } catch (err){
            return new Response(HttpCodesEnum.NOT_FOUND, `No session found with the accesstoken: ${accessToken}`);
        }

        this.metrics.addMetric("found session", MetricUnits.Count, 1);
        this.logger.debug("Session is " + JSON.stringify(session));
        // Validate the User Info data presence required to generate the VC
        const isValidUserCredentials = await this.validationHelper.validateUserInfo(session, this.logger);
        if(!isValidUserCredentials){
            return new Response(HttpCodesEnum.SERVER_ERROR, "Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
        }

        //Writing our own VC generation logic, later to invoke the common library function once ready.
        const signedJWT =
            await this.verifiableCredentialService.generateSignedVerifiableCredentialJwt(session, absoluteTimeNow);
        // return new Response(StatusCodes.OK, JSON.stringify(signedJWT));
        return new Response(HttpCodesEnum.OK, JSON.stringify({
            sub: session?.clientId,
            'https://vocab.account.gov.uk/v1/credentialJWT': [signedJWT]
        }));
    }
}
