import { CicSession } from "../models/CicSession";
import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { randomUUID } from "crypto";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { CicResponse } from "../utils/CicResponse";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import {AuthSessionState} from "../models/enums/AuthSessionState";

const SESSION_TABLE = process.env.SESSION_TABLE;
const TXMA_QUEUE_URL = process.env.TXMA_QUEUE_URL;

export class AuthorizationRequestProcessor {
	private static instance: AuthorizationRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly cicService: CicService;

	constructor(logger: Logger, metrics: Metrics) {
		if (!SESSION_TABLE) {
			logger.error("Environment variable SESSION_TABLE is not configured");
			throw new AppError( "Service incorrectly configured", 500);
		}
		if (!TXMA_QUEUE_URL) {
			logger.error("Environment variable TXMA_QUEUE_URL is not configured");
			throw new AppError( "Service incorrectly configured", 500);
		}
		this.logger = logger;
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;
		this.cicService = CicService.getInstance(SESSION_TABLE, this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics): AuthorizationRequestProcessor {
		if (!AuthorizationRequestProcessor.instance) {
			AuthorizationRequestProcessor.instance = new AuthorizationRequestProcessor(logger, metrics);
		}
		return AuthorizationRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent, sessionId: string): Promise<Response> {
		let cicSession;

		const session = await this.cicService.getSessionById(sessionId);

		if (session != null) {
			if (session.expiryDate < absoluteTimeNow()) {
				return new Response(HttpCodesEnum.UNAUTHORIZED, `Session with session id: ${sessionId} has expired`);
			}

			this.logger.info({ message: "found session", session });
			this.metrics.addMetric("found session", MetricUnits.Count, 1);
			if (session.authSessionState !== AuthSessionState.CIC_DATA_RECEIVED) {
				this.logger.warn(`Session is in the wrong state: ${session.authSessionState}, expected state should be ${AuthSessionState.CIC_SESSION_FINISHED}`)
				return new Response(HttpCodesEnum.UNAUTHORIZED, `Session is in the wrong state: ${session.authSessionState}`);
			}

			const authorizationCode = randomUUID()

			await this.cicService.setAuthorizationCode(sessionId, authorizationCode)
			// try {
			// 	await sqsAdapter.writeToSqs({
			// 		event_name: 'DCMAW_WEB_END',
			// 		...buildCoreEventFields(authSession, issuer, sourceIp, absoluteTimeNow)
			//
			// 	})
			// } catch (error) {
			// 	return left('Failed to write TXMA event DCMAW_WEB_END to SQS queue.')
			// }
			//await this.cicService.saveCICData(sessionId, cicSession);
			const cicResp = new CicResponse({
				authorizationCode: authorizationCode,
				redirect_uri: session?.redirectUri,
				state: session?.state,
			});

			return new Response(HttpCodesEnum.OK, JSON.stringify(cicResp));
		} else {
			return new Response(HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
		}
	}
}
