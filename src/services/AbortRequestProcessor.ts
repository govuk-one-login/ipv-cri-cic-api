import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { AppError } from "../utils/AppError";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";
import { MessageCodes } from "../models/enums/MessageCodes";
import { AuthSessionState } from "../models/enums/AuthSessionState";
import { EnvironmentVariables } from "../utils/Constants";


export class AbortRequestProcessor {

  private static instance: AbortRequestProcessor;

  private readonly logger: Logger;

  private readonly issuer: string;

  private readonly txmaQueueUrl: string;

  private readonly metrics: Metrics;

  private readonly cicService: CicService;

  constructor(logger: Logger, metrics: Metrics) {
  	this.issuer = checkEnvironmentVariable(EnvironmentVariables.ISSUER, logger);
  	this.txmaQueueUrl = checkEnvironmentVariable(EnvironmentVariables.TXMA_QUEUE_URL, logger);
  	const sessionTableName = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE, logger);

  	this.logger = logger;
  	this.metrics = metrics;
  	this.cicService = CicService.getInstance(sessionTableName, this.logger, createDynamoDbClient());
	
  }

  static getInstance(
  	logger: Logger,
  	metrics: Metrics,
  ): AbortRequestProcessor {
  	if (!AbortRequestProcessor.instance) {
  		AbortRequestProcessor.instance =
        new AbortRequestProcessor(logger, metrics);
  	}
  	return AbortRequestProcessor.instance;
  }

  async processRequest(sessionId: string): Promise<Response> {
  	const cicSessionInfo = await this.cicService.getSessionById(sessionId);
  	this.logger.appendKeys({
  		govuk_signin_journey_id: cicSessionInfo?.clientSessionId,
  	});

  	if (!cicSessionInfo) {
  		this.logger.warn("Missing details in SESSION TABLE", {
  			messageCode: MessageCodes.SESSION_NOT_FOUND,
  		});
  		throw new AppError("Missing details in SESSION table", HttpCodesEnum.BAD_REQUEST);
  	}

  	const decodedRedirectUri = decodeURIComponent(cicSessionInfo.redirectUri);
  	const hasQuestionMark = decodedRedirectUri.includes("?");
  	const redirectUri = `${decodedRedirectUri}${hasQuestionMark ? "&" : "?"}error=access_denied&state=${cicSessionInfo.state}`;

  	if (cicSessionInfo.authSessionState === AuthSessionState.CIC_CRI_SESSION_ABORTED) {
  		this.logger.info("Session has already been aborted");
  		return new Response(HttpCodesEnum.OK, "Session has already been aborted", { Location: encodeURIComponent(redirectUri) });
  	}

  	try {
  	  await this.cicService.updateSessionAuthState(cicSessionInfo.sessionId, AuthSessionState.CIC_CRI_SESSION_ABORTED);
  	} catch (error) {
  		this.logger.error("Error occurred while aborting the session", {
  			error,
  			messageCode: MessageCodes.SERVER_ERROR,
  		});
  		if (error instanceof AppError) {
  			return new Response(HttpCodesEnum.SERVER_ERROR, error.message);
  		} else {
  			return new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
  		}
  	}

  	try {
  		await this.cicService.sendToTXMA(this.txmaQueueUrl, {
  			event_name: "CIC_CRI_SESSION_ABORTED",
  			...buildCoreEventFields(cicSessionInfo, this.issuer, cicSessionInfo.clientIpAddress),
  		});
  	} catch (error) {
  		this.logger.error("Auth session successfully aborted. Failed to send CIC_CRI_SESSION_ABORTED event to TXMA", {
  			error,
  			messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
  		});
  	}

  	return new Response(HttpCodesEnum.OK, "Session has been aborted", { Location: encodeURIComponent(redirectUri) });
  }
}
