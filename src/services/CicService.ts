/* eslint-disable no-console */
import { CicSession } from "../models/CicSession";
import { SessionItem } from "../models/SessionItem";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError, SessionNotFoundError } from "../utils/AppError";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { DynamoDBDocument, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ExternalCode } from "../vendor/ExternalCode";
import {HttpCodesEnum} from "../utils/HttpCodesEnum";


export class CicService {
    readonly tableName: string;

    private readonly dynamo: DynamoDBDocument;

    readonly logger: Logger;

    private static instance: CicService;

    private static externalInstance: ExternalCode;

    constructor(tableName: any, logger: Logger) {
    	this.tableName = tableName;
    	this.dynamo = createDynamoDbClient();
    	this.logger = logger;
    	CicService.externalInstance = new ExternalCode();
    }


    static getInstance(tableName: string, logger: Logger): CicService {
    	if (!CicService.instance) {
			logger.debug("creating new instance "+tableName);
    		CicService.instance = new CicService(tableName, logger);
    	}
    	return CicService.instance;
    }

    async getSessionById(sessionId: string): Promise<SessionItem | undefined> {
    	this.logger.debug("Table name "+ this.tableName);
		this.logger.debug("Dynamo "+ JSON.stringify(this.dynamo))
    	const getSessionCommand = new GetCommand({
    		TableName: this.tableName,
    		Key: {
    			sessionId
    		},
    	});
		this.logger.debug("getSessionCommand "+ JSON.stringify(getSessionCommand));
    	let session;
    	try {
    		session = await this.dynamo.send(getSessionCommand);
    	} catch (e: any) {
    		this.logger.error("getSessionById - failed executing get from dynamodb: " + e);
    		throw new AppError("Error retrieving Session", HttpCodesEnum.SERVER_ERROR);
    	}

		this.logger.debug("Completed get")
    	if (!session.Item) {
    		throw new SessionNotFoundError(`Could not find session item with id: ${sessionId}`);
    	}
    	return new SessionItem(session.Item);
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

    	this.logger.info("updateItem - updating CIC data in dynamodb" + JSON.stringify(saveCICCommand));
    	try {
    		await this.dynamo.send(saveCICCommand);
    		this.logger.info("updateItem - updated CIC data in dynamodb" + JSON.stringify(saveCICCommand));
    	} catch (error) {
    		this.logger.error("got error " + error);
    		throw new AppError("updateItem - failed ", 500);
    	}
    }

    async setAuthorizationCode(sessionId: string, uuid: string): Promise<void> {
    	this.logger.debug(sessionId);

    	const updateSessionCommand = new UpdateCommand({
    		TableName: this.tableName,
    		Key: { sessionId },
    		UpdateExpression: "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry",
    		ExpressionAttributeValues: {
    			":authCode": uuid,
    			":authCodeExpiry": CicService.externalInstance.getAuthorizationCodeExpirationEpoch(),
    		},
    	});

    	this.logger.debug("updateItem - updating authorizationCode dynamodb" + JSON.stringify(updateSessionCommand));

    	try {
    		await this.dynamo.send(updateSessionCommand);
    		this.logger.info("updateItem - updated authorizationCode in dynamodb" + JSON.stringify(updateSessionCommand));
    	} catch (e: any) {
    		this.logger.error("got error " + e);
    		throw new AppError("updateItem - failed ", 500);
    	}
    }
}
