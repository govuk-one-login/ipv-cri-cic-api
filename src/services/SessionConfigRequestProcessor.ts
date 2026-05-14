import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { logger } from "@govuk-one-login/cri-logger";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { MessageCodes } from "../models/enums/MessageCodes";
import { Constants, EnvironmentVariables } from "../utils/Constants";
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";
import { APIGatewayProxyResult } from "aws-lambda";

export class SessionConfigRequestProcessor {
	private static instance: SessionConfigRequestProcessor;

	private readonly metrics: Metrics;

	private readonly cicService: CicService;

	constructor(metrics: Metrics) {
		this.metrics = metrics;
		const sessionTableName: string = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE);
  	
		this.cicService = CicService.getInstance(sessionTableName, createDynamoDbClient());
	}

	static getInstance(metrics: Metrics): SessionConfigRequestProcessor {
		if (!SessionConfigRequestProcessor.instance) {
			SessionConfigRequestProcessor.instance = new SessionConfigRequestProcessor(metrics);
		}
		return SessionConfigRequestProcessor.instance;
	}

	async processRequest(sessionId: string): Promise<APIGatewayProxyResult> {

		const session = await this.cicService.getSessionById(sessionId);

		if (session) {
			logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

			this.metrics.addMetric("found session", MetricUnit.Count, 1);

			return Response(HttpCodesEnum.OK, JSON.stringify({
				journey_type: session?.journey ? session.journey : Constants.FACE_TO_FACE_JOURNEY,
			}));
		} else {
			logger.error("No session found for session id", {
				messageCode: MessageCodes.SESSION_NOT_FOUND,
			});
			return Response(HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
		}
	}
}
