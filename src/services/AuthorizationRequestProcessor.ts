import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { randomUUID } from "crypto";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { AuthSessionState } from "../models/enums/AuthSessionState";
import { MessageCodes } from "../models/enums/MessageCodes";
import { buildCoreEventFields } from "../utils/TxmaEvent";

const SESSION_TABLE = process.env.SESSION_TABLE;
const TXMA_QUEUE_URL = process.env.TXMA_QUEUE_URL;
const ISSUER = process.env.ISSUER!;

export class AuthorizationRequestProcessor {
	private static instance: AuthorizationRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly cicService: CicService;

	constructor(logger: Logger, metrics: Metrics) {
		if (!SESSION_TABLE || !TXMA_QUEUE_URL || !ISSUER) {
			logger.error("Environment variable SESSION_TABLE or TXMA_QUEUE_URL or ISSUER is not configured", {
				messageCode: MessageCodes.MISSING_CONFIGURATION,
			});
			throw new AppError( "Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
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

		const session = await this.cicService.getSessionById(sessionId);

		if (session != null) {
			this.logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

			if (session.expiryDate < absoluteTimeNow()) {
				this.logger.error("Session has expired", { messageCode: MessageCodes.EXPIRED_SESSION });
				return new Response(HttpCodesEnum.UNAUTHORIZED, `Session with session id: ${sessionId} has expired`);
			}

			this.metrics.addMetric("found session", MetricUnits.Count, 1);

			switch (session.authSessionState) {
			  case AuthSessionState.CIC_DATA_RECEIVED:
					break;
			  case AuthSessionState.CIC_AUTH_CODE_ISSUED:
			  case AuthSessionState.CIC_ACCESS_TOKEN_ISSUED:
					this.logger.info(`Duplicate request for session in state: ${session.authSessionState}, returning authCode from DB`, sessionId);
					return new Response(HttpCodesEnum.OK, JSON.stringify({
						authorizationCode: {
							value: session.authorizationCode,
						},
						redirect_uri: session?.redirectUri,
						state: session?.state,
					}));
				default:
					this.logger.error(`Session is in an unexpected state: ${session.authSessionState}, expected state should be ${AuthSessionState.CIC_DATA_RECEIVED}, ${AuthSessionState.CIC_AUTH_CODE_ISSUED} or ${AuthSessionState.CIC_ACCESS_TOKEN_ISSUED}`, { 
						messageCode: MessageCodes.INCORRECT_SESSION_STATE,
					});
					return new Response(HttpCodesEnum.UNAUTHORIZED, `Session is in the wrong state: ${session.authSessionState}`);
			}

			// add govuk_signin_journey_id to all subsequent log messages
			this.logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

			const authorizationCode = randomUUID();
			await this.cicService.setAuthorizationCode(sessionId, authorizationCode);
			this.metrics.addMetric("Set authorization code", MetricUnits.Count, 1);

			try {
				await this.cicService.sendToTXMA({
					event_name: "CIC_CRI_AUTH_CODE_ISSUED",
					...buildCoreEventFields(session, ISSUER, session.clientIpAddress),

				});
			} catch (error) {
				this.logger.error("Failed to write TXMA event CIC_CRI_AUTH_CODE_ISSUED to SQS queue.", {
					error,
					messageCode: MessageCodes.ERROR_WRITING_TXMA,
				});
			}

			const cicResp = {
				authorizationCode: {
					value: authorizationCode,
				},
				redirect_uri: session?.redirectUri,
				state: session?.state,
			};

			return new Response(HttpCodesEnum.OK, JSON.stringify(cicResp));
		} else {
			this.logger.error("No session found for session id", {
				messageCode: MessageCodes.SESSION_NOT_FOUND,
			});
			return new Response(HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
		}
	}
}
