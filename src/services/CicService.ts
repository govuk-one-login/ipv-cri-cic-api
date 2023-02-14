/* eslint-disable no-console */
import { CicSession } from "../models/CicSession";
import { SessionItem } from "../models/SessionItem";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, QueryCommand, QueryCommandInput, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { getAuthorizationCodeExpirationEpoch } from "../utils/DateTimeUtils";


export class CicService {
	readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

	private readonly sqs: SQSClient;

	readonly logger: Logger;

	private static instance: CicService;

	constructor(tableName: any, logger: Logger, dynamoDbClient: DynamoDBDocument, sqsClient: SQSClient) {
		this.tableName = tableName;
		this.dynamo = dynamoDbClient;
		this.sqs = sqsClient;
		this.logger = logger;
	}

	static getInstance(tableName: string, logger: Logger, dynamoDbClient: DynamoDBDocument): CicService {
		if (!CicService.instance) {
			CicService.instance = new CicService(tableName, logger, dynamoDbClient);
		}
		return CicService.instance;
	}

	async getSessionById(sessionId: string): Promise<SessionItem | undefined> {
		this.logger.debug("Table name " + this.tableName);
		const getSessionCommand = new GetCommand({
			TableName: this.tableName,
			Key: {
				sessionId,
			},
		});

		let session;
		try {
			session = await this.dynamo.send(getSessionCommand);
		} catch (e: any) {
			this.logger.error("getSessionById - failed executing get from dynamodb: " + e);
			throw new AppError("Error retrieving Session", HttpCodesEnum.SERVER_ERROR);
		}

		if (session.Item) {
			return new SessionItem(session.Item);
		}

	}

	async saveCICData(sessionId: string, cicData: CicSession): Promise<void> {
		this.logger.debug(sessionId);

		const saveCICCommand: any = new UpdateCommand({
			TableName: this.tableName,
			Key: { sessionId },
			UpdateExpression: "SET fullName = :fullName, dateOfBirth = :dateOfBirth, documentSelected = :documentSelected, dateOfExpiry =:dateOfExpiry",

			ExpressionAttributeValues: {
				":fullName": cicData.fullName,
				":dateOfBirth": cicData.dateOfBirth,
				":documentSelected": cicData.documentSelected,
				":dateOfExpiry": cicData.dateOfExpiry,
			},
		});

		this.logger.info("updating CIC data in dynamodb" + JSON.stringify(saveCICCommand));
		try {
			await this.dynamo.send(saveCICCommand);
			this.logger.info("updated CIC data in dynamodb" + JSON.stringify(saveCICCommand));
		} catch (error) {
			this.logger.error("got error " + error);
			throw new AppError("updateItem - failed ", 500);
		}
	}

	async setAuthorizationCode(sessionId: string, uuid: string): Promise<void> {

		const updateSessionCommand = new UpdateCommand({
			TableName: this.tableName,
			Key: { sessionId },
			UpdateExpression: "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry",
			ExpressionAttributeValues: {
				":authCode": uuid,
				":authCodeExpiry": getAuthorizationCodeExpirationEpoch(process.env.AUTHORIZATION_CODE_TTL),
			},
		});

		this.logger.info("updating authorizationCode dynamodb" + JSON.stringify(updateSessionCommand));

		try {
			await this.dynamo.send(updateSessionCommand);
			this.logger.info("updated authorizationCode in dynamodb" + JSON.stringify(updateSessionCommand));
		} catch (e: any) {
			this.logger.error("got error " + e);
			throw new AppError("updateItem - failed ", 500);
		}
	}

	async createAuthSession(session: IFullAuthSession): Promise<void> {
		this.logger.debug(session.authSessionId);

		const createAuthSessionCommand: any = new UpdateCommand({
			TableName: this.tableName,
			Key: { sessionId: session.authSessionId },
			UpdateExpression: "SET fullName = :fullName, dateOfBirth = :dateOfBirth, documentSelected = :documentSelected, dateOfExpiry =:dateOfExpiry",

			ExpressionAttributeValues: {
				":sessionId": session.authSessionId,
				":subjectIdentifier": session.subjectIdentifier,
				":redirect_uri": session.redirectUri,
				":state": session.state,
				":issuer": session.issuer,
				":timeToLive": session.timeToLive.toString(),
				":issuedOn": session.issuedOn.toString(),
				":authSessionState": session.authSessionState,
				":biometricSessionId": "",
				":clientId": session.clientId,
				":journeyId": session.journeyId,
				":abortReason": "",
			},
		});

		this.logger.info("saving session data in dynamodb" + JSON.stringify(createAuthSessionCommand));
		try {
			await this.dynamo.send(createAuthSessionCommand);
			this.logger.info("updated CIC data in dynamodb" + JSON.stringify(createAuthSessionCommand));
		} catch (error) {
			this.logger.error("got error " + error);
			throw new AppError("saveItem - failed ", 500);
		}
	}

	async getSessionByAccessToken(accessToken: string): Promise<SessionItem | undefined> {
		this.logger.debug("Table name " + this.tableName);
		const getSessionCommand: QueryCommandInput = {
			IndexName: "access-token-index",
			KeyConditionExpression: "accessToken = :accessToken",
			ExpressionAttributeValues: { ":accessToken": accessToken },
			TableName: this.tableName,
			Limit: 1,
		};
		let session;
		try {
			session = await this.dynamo.send(new QueryCommand(getSessionCommand));
			this.logger.info("Found Session: " + JSON.stringify(session.Items));
		} catch (e: any) {
			this.logger.error("getSessionByAccessToken - failed executing get from dynamodb: " + e);
			throw new AppError("Error retrieving Session", HttpCodesEnum.SERVER_ERROR);
		}

		if (session.Items) {
			const sessionId: string = session.Items[0].sessionId;
			return this.getSessionById(sessionId);
		}
	}

	async sendToTXMA(messageBody: string): Promise<void> {
		var params = {
		 MessageBody: messageBody,
		 QueueUrl: process.env.TXMA_QUEUE_URL,
	 };

		this.logger.info("updating CIC data in dynamodb" + JSON.stringify(saveCICCommand));
		try {
			await this.sqs.sendMessage(params);
			this.logger.info("updated CIC data in dynamodb" + JSON.stringify(saveCICCommand));
		} catch (error) {
			this.logger.error("got error " + error);
			throw new AppError("updateItem - failed ", 500);
		}
	}

}
