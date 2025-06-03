import { CicSession } from "../models/CicSession";
import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { AuthSessionState } from "../models/enums/AuthSessionState";
import { MessageCodes } from "../models/enums/MessageCodes";
import { checkEnvironmentVariable } from "../utils/EnvironmentVariables";
import { EnvironmentVariables } from "../utils/Constants";

export class ClaimedIdRequestProcessor {
	private static instance: ClaimedIdRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly cicService: CicService;

	private readonly personIdentityTableName: string;

	constructor(logger: Logger, metrics: Metrics) {
		this.logger = logger;
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;
		const sessionTableName: string = checkEnvironmentVariable(EnvironmentVariables.SESSION_TABLE, this.logger);
		this.personIdentityTableName = checkEnvironmentVariable(EnvironmentVariables.PERSON_IDENTITY_TABLE_NAME, this.logger);
  			
		this.cicService = CicService.getInstance(sessionTableName, this.logger, createDynamoDbClient());
	}

	static getInstance(logger: Logger, metrics: Metrics): ClaimedIdRequestProcessor {
		if (!ClaimedIdRequestProcessor.instance) {
			ClaimedIdRequestProcessor.instance = new ClaimedIdRequestProcessor(logger, metrics);
		}
		return ClaimedIdRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent, sessionId: string): Promise<Response> {
		let cicSession;
		try {
			const bodyParsed = JSON.parse(event.body as string);
			// Convert given_names and family_names string into string[]
			bodyParsed.given_names = bodyParsed.given_names.split(" ");
		
			cicSession = new CicSession(bodyParsed);
			await this.validationHelper.validateModel(cicSession, this.logger);
			this.logger.debug({ message: "CIC Session is", cicSession });
		} catch (error) {
			this.logger.error("Missing mandatory fields in the request payload", {
				error,
				messageCode: MessageCodes.PAYLOAD_VALIDATION_FAILED,
			});
			return new Response(HttpCodesEnum.BAD_REQUEST, "Missing mandatory fields in the request payload");
		}

		const session = await this.cicService.getSessionById(sessionId);
		if (session != null) {

			this.logger.appendKeys({ govuk_signin_journey_id: session.clientSessionId });

			if (session.expiryDate < absoluteTimeNow()) {
				this.logger.error("Session has expired", { messageCode: MessageCodes.EXPIRED_SESSION });
				return new Response(HttpCodesEnum.UNAUTHORIZED, `Session with session id: ${sessionId} has expired`);
			}

			this.metrics.addMetric("Found session", MetricUnits.Count, 1);

			switch (session.authSessionState) {
			  case AuthSessionState.CIC_SESSION_CREATED:
					await this.cicService.saveCICData(sessionId, cicSession, session.expiryDate, this.personIdentityTableName);
					return new Response(HttpCodesEnum.OK, "");
			  case AuthSessionState.CIC_DATA_RECEIVED:
			  case AuthSessionState.CIC_AUTH_CODE_ISSUED:
			  case AuthSessionState.CIC_ACCESS_TOKEN_ISSUED:
					this.logger.info(`Duplicate request for session in state: ${session.authSessionState}`, sessionId);
					return new Response(HttpCodesEnum.OK, "Request already processed");
				default:
					this.logger.error(`Session is in an unexpected state: ${session.authSessionState}, expected state should be ${AuthSessionState.CIC_SESSION_CREATED}, ${AuthSessionState.CIC_DATA_RECEIVED}, ${AuthSessionState.CIC_AUTH_CODE_ISSUED} or ${AuthSessionState.CIC_ACCESS_TOKEN_ISSUED}`, { 
						messageCode: MessageCodes.INCORRECT_SESSION_STATE,
					});
					return new Response(HttpCodesEnum.UNAUTHORIZED, `Session is in the wrong state: ${session.authSessionState}`);
			}

		} else {
			this.logger.error("No session found for session id", {
				messageCode: MessageCodes.SESSION_NOT_FOUND,
			});
			return new Response(HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
		}
	}
}
