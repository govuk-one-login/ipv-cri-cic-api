import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { AppError } from "../utils/AppError";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { ServicesEnum } from "../models/enums/ServicesEnum"
import { MessageCodes } from "../models/enums/MessageCodes";
import { AuthSessionState } from "../models/enums/AuthSessionState";

const ISSUER = process.env.issuer;
const SESSION_TABLE = process.env.SESSION_TABLE!;

export class AbortRequestProcessor {

  private static instance: AbortRequestProcessor;

  private readonly logger: Logger;

  private readonly metrics: Metrics;

  private readonly cicService: CicService;

  constructor(logger: Logger, metrics: Metrics) {
	if (!SESSION_TABLE || SESSION_TABLE.trim().length === 0 ||
		//!TXMA_QUEUE_URL || TXMA_QUEUE_URL.trim().length === 0 ||
		!ISSUER || ISSUER.trim().length === 0) {
					logger.error("Environment variable SESSION_TABLE or TXMA_QUEUE_URL or ISSUER is not configured");
					throw new AppError("Abort Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
				}
  	this.logger = logger;
  	this.metrics = metrics;
  	this.cicService = CicService.getInstance(SESSION_TABLE, this.logger, createDynamoDbClient());
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
  		await this.cicService.sendToTXMA({
  			event_name: "CIC_CRI_SESSION_ABORTED",
  			...buildCoreEventFields(cicSessionInfo, ISSUER as string, cicSessionInfo.clientIpAddress),
  		});
  	} catch (error) {
  		this.logger.error("Auth session successfully aborted. Failed to send CIC_CRI_SESSION_ABORTED event to TXMA", {
  			error,
  			messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
  		});
  	}

  	const redirectUri = `${cicSessionInfo.redirectUri}?error=access_denied&state=${AuthSessionState.CIC_CRI_SESSION_ABORTED}`;
	return new Response(HttpCodesEnum.FOUND_REDIRECT, "Session has been aborted", { Location: redirectUri });
  }
}
