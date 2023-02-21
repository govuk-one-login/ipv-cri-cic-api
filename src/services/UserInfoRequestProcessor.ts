import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { AppError } from "../utils/AppError";
import { VerifiableCredentialService } from "../utils/VerifiableCredentialService";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { ISessionItem } from "../models/ISessionItem";

const SESSION_TABLE = process.env.SESSION_TABLE;
const KMS_KEY_ARN = process.env.KMS_KEY_ARN;

export class UserInfoRequestProcessor {
    private static instance: UserInfoRequestProcessor;

    private readonly logger: Logger;

    private readonly metrics: Metrics;

    private readonly validationHelper: ValidationHelper;

    private readonly cicService: CicService;

    private readonly kmsJwtAdapter: KmsJwtAdapter;

    private readonly verifiableCredentialService: VerifiableCredentialService;

    constructor(logger: Logger, metrics: Metrics) {
    	if (!SESSION_TABLE) {
    		logger.error("Environment variable SESSION_TABLE is not configured");
    		throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR );
    	}
    	if (!KMS_KEY_ARN) {
    		logger.error("Environment variable KMS_KEY_ARN is not configured");
    		throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR );
    	}
    	this.logger = logger;
    	this.validationHelper = new ValidationHelper();
    	this.metrics = metrics;
    	this.cicService = CicService.getInstance(SESSION_TABLE, this.logger, createDynamoDbClient());
    	this.kmsJwtAdapter = new KmsJwtAdapter(KMS_KEY_ARN);
    	this.verifiableCredentialService = VerifiableCredentialService.getInstance(SESSION_TABLE, this.kmsJwtAdapter, this.logger);
    }

    static getInstance(logger: Logger, metrics: Metrics): UserInfoRequestProcessor {
    	if (!UserInfoRequestProcessor.instance) {
    		UserInfoRequestProcessor.instance = new UserInfoRequestProcessor(logger, metrics);
    	}
    	return UserInfoRequestProcessor.instance;
    }

    async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
    	// Validate the Authentication header and retrieve the sub (sessionId) from the JWT token.
    	let sub;
    	try {
    		sub = await this.validationHelper.eventToSubjectIdentifier(this.kmsJwtAdapter, event);
    	} catch (error) {
    		if (error instanceof AppError) {
    			console.log(`${event.headers}`);
    			console.log("**** Error validating Authentication Access token from headers: " + error.message);
    			return new Response( HttpCodesEnum.BAD_REQUEST, "Failed to Validate - Authentication header: " + error.message );
    		}
    	}

    	let session :ISessionItem | undefined;
    	try {
    		session = await this.cicService.getSessionById(sub as string);
    		console.log("Found Session: " + JSON.stringify(session));
    		if (!session) {
    			return new Response(HttpCodesEnum.NOT_FOUND, `No session found with the sessionId: ${sub}`);
    		}
    	} catch (err) {
    		return new Response(HttpCodesEnum.NOT_FOUND, `No session found with the sessionId: ${sub}`);
    	}

    	this.metrics.addMetric("found session", MetricUnits.Count, 1);
    	this.logger.debug("Session is " + JSON.stringify(session));
    	// Validate the User Info data presence required to generate the VC
    	const isValidUserCredentials = this.validationHelper.validateUserInfo(session, this.logger);
    	if (!isValidUserCredentials) {
    		return new Response(HttpCodesEnum.SERVER_ERROR, "Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
    	}

    	//Generate VC and create a signedVC as response back to IPV Core.
    	const signedJWT = await this.verifiableCredentialService.generateSignedVerifiableCredentialJwt(session, absoluteTimeNow);
    	if (signedJWT === null || signedJWT === undefined) {
    		return new Response(HttpCodesEnum.SERVER_ERROR, "Failed to sign the verifiableCredential Jwt");
    	}
    	return new Response(HttpCodesEnum.OK, JSON.stringify({
    		sub: session?.clientId,
    		"https://vocab.account.gov.uk/v1/credentialJWT": [signedJWT],
    	}));
    }
}
