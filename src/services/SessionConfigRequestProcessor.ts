import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { MessageCodes } from "../models/enums/MessageCodes";
import { Constants } from "../utils/Constants";

const SESSION_TABLE = process.env.SESSION_TABLE;

export class SessionConfigRequestProcessor {
	private static instance: SessionConfigRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly cicService: CicService;

	constructor(logger: Logger, metrics: Metrics) {
		if (!SESSION_TABLE) {
			logger.error("Environment variable SESSION_TABLE is not configured", {
				messageCode: MessageCodes.MISSING_CONFIGURATION,
			});
			throw new AppError( "Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
		}
		this.logger = logger;
		this.metrics = metrics;
		this.cicService = CicService.getInstance(SESSION_TABLE, this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionConfigRequestProcessor {
		if (!SessionConfigRequestProcessor.instance) {
			SessionConfigRequestProcessor.instance = new SessionConfigRequestProcessor(logger, metrics);
		}
		return SessionConfigRequestProcessor.instance;
	}

	async processRequest(sessionId: string): Promise<Response> {

		const session = await this.cicService.getSessionById(sessionId);

		if (session) {
			this.logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

			this.metrics.addMetric("found session", MetricUnits.Count, 1);

			return new Response(HttpCodesEnum.OK, JSON.stringify({
				journey_type: session?.journey ? session.journey : Constants.FACE_TO_FACE_JOURNEY,
			}));
		} else {
			this.logger.error("No session found for session id", {
				messageCode: MessageCodes.SESSION_NOT_FOUND,
			});
			return new Response(HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
		}
	}
}
