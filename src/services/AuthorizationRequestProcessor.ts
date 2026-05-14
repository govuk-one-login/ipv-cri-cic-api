 
import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { randomUUID } from "crypto";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "@govuk-one-login/cri-logger";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { AuthSessionState } from "../models/enums/AuthSessionState";
import { MessageCodes } from "../models/enums/MessageCodes";
import { buildCoreEventFields } from "../utils/TxmaEvent";
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";
import { EnvironmentVariables } from "../utils/Constants";
import { TxmaEventNames } from "../models/enums/TxmaEvents";

export class AuthorizationRequestProcessor {
	private static instance: AuthorizationRequestProcessor;

	private readonly metrics: Metrics;

	private readonly cicService: CicService;

	private readonly issuer: string;

	private readonly txmaQueueUrl: string;

	constructor(metrics: Metrics) {
		this.metrics = metrics;
		const sessionTableName: string = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE);
		this.issuer = checkEnvironmentVariable(EnvironmentVariables.ISSUER);
		this.txmaQueueUrl = checkEnvironmentVariable(EnvironmentVariables.TXMA_QUEUE_URL);
  			
		this.cicService = CicService.getInstance(sessionTableName, createDynamoDbClient());
	}

	static getInstance(metrics: Metrics): AuthorizationRequestProcessor {
		if (!AuthorizationRequestProcessor.instance) {
			AuthorizationRequestProcessor.instance = new AuthorizationRequestProcessor(metrics);
		}
		return AuthorizationRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent, sessionId: string): Promise<APIGatewayProxyResult> {

		const session = await this.cicService.getSessionById(sessionId);
		
		if (session != null) {
			logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

			if (session.expiryDate < absoluteTimeNow()) {
				logger.error("Session has expired", { messageCode: MessageCodes.EXPIRED_SESSION });
				return Response(HttpCodesEnum.UNAUTHORIZED, `Session with session id: ${sessionId} has expired`);
			}

			this.metrics.addMetric("found session", MetricUnit.Count, 1);

			switch (session.authSessionState) {
			  case AuthSessionState.CIC_DATA_RECEIVED:
					break;
			  case AuthSessionState.CIC_AUTH_CODE_ISSUED:
			  case AuthSessionState.CIC_ACCESS_TOKEN_ISSUED:
					logger.info(`Duplicate request for session in state: ${session.authSessionState}, returning authCode from DB`, sessionId);
					return Response(HttpCodesEnum.OK, JSON.stringify({
						authorizationCode: {
							value: session.authorizationCode,
						},
						redirect_uri: session?.redirectUri,
						state: session?.state,
					}));
				default:
					logger.error(`Session is in an unexpected state: ${session.authSessionState}, expected state should be ${AuthSessionState.CIC_DATA_RECEIVED}, ${AuthSessionState.CIC_AUTH_CODE_ISSUED} or ${AuthSessionState.CIC_ACCESS_TOKEN_ISSUED}`, { 
						messageCode: MessageCodes.INCORRECT_SESSION_STATE,
					});
					return Response(HttpCodesEnum.UNAUTHORIZED, `Session is in the wrong state: ${session.authSessionState}`);
			}

			// add govuk_signin_journey_id to all subsequent log messages
			logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

			const authorizationCode = randomUUID();
			await this.cicService.setAuthorizationCode(sessionId, authorizationCode);
			this.metrics.addMetric("Set authorization code", MetricUnit.Count, 1);

			try {
				await this.cicService.sendToTXMA({
					event_name: TxmaEventNames.CIC_CRI_AUTH_CODE_ISSUED,
					...buildCoreEventFields(session, this.issuer, session.clientIpAddress),

				});
			} catch (error) {
				logger.error("Failed to write TXMA event CIC_CRI_AUTH_CODE_ISSUED to SQS queue.", {
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

			return Response(HttpCodesEnum.OK, JSON.stringify(cicResp));
		} else {
			logger.error("No session found for session id", {
				messageCode: MessageCodes.SESSION_NOT_FOUND,
			});
			return Response(HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
		}
	}
}
