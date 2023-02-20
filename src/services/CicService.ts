/* eslint-disable no-console */
import { CicSession } from "../models/CicSession";
import { ISessionItem } from "../models/ISessionItem";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { getAuthorizationCodeExpirationEpoch } from "../utils/DateTimeUtils";

export class CicService {
    readonly tableName: string;

    private readonly dynamo: DynamoDBDocument;

    readonly logger: Logger;

    private static instance: CicService;

    constructor(tableName: any, logger: Logger, dynamoDbClient: DynamoDBDocument) {
    	this.tableName = tableName;
    	this.dynamo = dynamoDbClient;
    	this.logger = logger;
    }

    static getInstance(tableName: string, logger: Logger, dynamoDbClient: DynamoDBDocument): CicService {
    	if (!CicService.instance) {
    		CicService.instance = new CicService(tableName, logger, dynamoDbClient);
    	}
    	return CicService.instance;
    }

    async getSessionById(sessionId: string): Promise<ISessionItem | undefined> {
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
    		this.logger.error({ message: "getSessionById - failed executing get from dynamodb:", e });
    		throw new AppError("Error retrieving Session", HttpCodesEnum.SERVER_ERROR);
    	}

    	if (session.Item) {
    		return session.Item as ISessionItem;
    	}

    }

    async saveCICData(sessionId: string, cicData: CicSession): Promise<void> {

    	const saveCICCommand: any = new UpdateCommand({
    		TableName: this.tableName,
    		Key: { sessionId },
    		UpdateExpression: "SET full_name = :full_name, date_of_birth = :date_of_birth, document_selected = :document_selected, date_of_expiry =:date_of_expiry",

    		ExpressionAttributeValues: {
    			":full_name": cicData.full_name,
    			":date_of_birth": cicData.date_of_birth,
    			":document_selected": cicData.document_selected,
    			":date_of_expiry": cicData.date_of_expiry,
    		},
    	});

    	this.logger.info({ message: "updating CIC data in dynamodb", saveCICCommand });
    	try {
    		await this.dynamo.send(saveCICCommand);
    		this.logger.info({ message: "updated CIC data in dynamodb" });
    	} catch (error) {
    		this.logger.error({ message: "got error saving CIC data", error });
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

    	this.logger.info({ message: "updating authorizationCode dynamodb", updateSessionCommand });

    	try {
    		await this.dynamo.send(updateSessionCommand);
    		this.logger.info({ message: "updated authorizationCode in dynamodb" });
    	} catch (e: any) {
    		this.logger.error({ message: "got error setting auth code", e });
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
