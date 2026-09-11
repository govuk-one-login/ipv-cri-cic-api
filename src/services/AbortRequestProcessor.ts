import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { AppError } from "../utils/AppError";
import { logger } from "@govuk-one-login/cri-logger";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";
import { MessageCodes } from "../models/enums/MessageCodes";
import { AuthSessionState } from "../models/enums/AuthSessionState";
import { EnvironmentVariables } from "../utils/Constants";
import { TxmaEventNames } from "../models/enums/TxmaEvents";
import { APIGatewayProxyResult } from "aws-lambda";


export class AbortRequestProcessor {

  private static instance: AbortRequestProcessor;

  private readonly issuer: string;

  private readonly txmaQueueUrl: string;

  private readonly metrics: Metrics;

  private readonly cicService: CicService;

  constructor(metrics: Metrics) {
  	this.issuer = checkEnvironmentVariable(EnvironmentVariables.ISSUER);
  	this.txmaQueueUrl = checkEnvironmentVariable(EnvironmentVariables.TXMA_QUEUE_URL);
  	const sessionTableName = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE);

  	this.metrics = metrics;
  	this.cicService = CicService.getInstance(sessionTableName, createDynamoDbClient());
	
  }

  static getInstance(
  	metrics: Metrics,
  ): AbortRequestProcessor {
  	if (!AbortRequestProcessor.instance) {
  		AbortRequestProcessor.instance =
        new AbortRequestProcessor(metrics);
  	}
  	return AbortRequestProcessor.instance;
  }

  async processRequest(sessionId: string, encodedHeader: string): Promise<APIGatewayProxyResult> {
  	const cicSessionInfo = await this.cicService.getSessionById(sessionId);
  	logger.appendKeys({
  		govuk_signin_journey_id: cicSessionInfo?.clientSessionId,
  	});

  	if (!cicSessionInfo) {
  		logger.error("Missing details in SESSION TABLE", {
  			messageCode: MessageCodes.SESSION_NOT_FOUND,
  		});
  		throw new AppError(HttpCodesEnum.BAD_REQUEST, "Missing details in SESSION table");
  	}

  	const decodedRedirectUri = decodeURIComponent(cicSessionInfo.redirectUri);
  	const hasQuestionMark = decodedRedirectUri.includes("?");
  	const redirectUri = `${decodedRedirectUri}${hasQuestionMark ? "&" : "?"}error=access_denied&state=${cicSessionInfo.state}`;

  	if (cicSessionInfo.authSessionState === AuthSessionState.CIC_CRI_SESSION_ABORTED) {
  		logger.info("Session has already been aborted");
  		return Response(HttpCodesEnum.OK, "Session has already been aborted", { Location: encodeURIComponent(redirectUri) });
  	}

  	try {
  	  await this.cicService.updateSessionAuthState(cicSessionInfo.sessionId, AuthSessionState.CIC_CRI_SESSION_ABORTED);
	  this.metrics.addMetric("state-CIC_CRI_SESSION_ABORTED", MetricUnit.Count, 1);

	} catch (error) {
  		logger.error("Error occurred while aborting the session", {
  			error,
  			messageCode: MessageCodes.SERVER_ERROR,
  		});
  		if (error instanceof AppError) {
  			return Response(HttpCodesEnum.SERVER_ERROR, error.message);
  		} else {
  			return Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred");
  		}
  	}

  	try {
  		await this.cicService.sendToTXMA({
  			event_name: TxmaEventNames.CIC_CRI_SESSION_ABORTED,
  			...buildCoreEventFields(cicSessionInfo, this.issuer, cicSessionInfo.clientIpAddress),
  		}, encodedHeader);
  	} catch (error) {
  		logger.error("Auth session successfully aborted. Failed to send CIC_CRI_SESSION_ABORTED event to TXMA", {
  			error,
  			messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
  		});
  	}

  	return Response(HttpCodesEnum.OK, "Session has been aborted", { Location: encodeURIComponent(redirectUri) });
  }
}
