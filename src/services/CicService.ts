/* eslint-disable no-console */
import { CicSession } from "../models/CicSession";
import { SessionItem } from "../models/SessionItem";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError, SessionNotFoundError } from "../utils/AppError";
import { StatusCodes } from "http-status-codes";
import { createDynamoDbClient } from "../utils/aws-client-factory";
import { DynamoDBDocument, GetCommand } from "@aws-sdk/lib-dynamodb";

export class CicService {
  readonly tableName: string;

  private readonly dynamo: DynamoDBDocument;

  readonly logger: Logger;

  private static instance: CicService;

  constructor(tableName: any, logger: Logger) {
  	// throw error if tableName iss null
  	this.tableName = tableName;
  	this.dynamo = createDynamoDbClient();
  	this.logger = logger;
  }

  static getInstance(tableName: string, logger: Logger): CicService {
  	if (!CicService.instance) {
  		CicService.instance = new CicService(tableName, logger);
  	}
  	return CicService.instance;
  }

  async getSessionById(sessionId: string): Promise<SessionItem | undefined> {
  	//const tableName = await this.configService.getSessionTableName();
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
  		throw new AppError("Error retrieving Session", 500);
  	}

  	if (!session.Item) {
  		throw new SessionNotFoundError(`Could not find session item with id: ${sessionId}`);
  	}
  	return new SessionItem(session.Item);
  }

  // async getSessionById(sessionId: string): Promise<SessionItem | undefined> {
  // 	let session;
  // 	this.logger.debug("Table name " + this.tableName);
  // 	this.logger.debug("Session id " + sessionId);
  // 	const params = {
  // 		TableName: this.tableName,
  // 		Key: {
  // 			sessionId,
  // 		},
  // 	};
  // 	try {
  // 		session = await this.dynamo.get(params).promise();
  // 	}
  //
  // 	if (!session?.Item) {
  // 		this.logger.error("no session found");
  // 		throw new AppError(StatusCodes.NOT_FOUND, "Session was not found");
  // 	}
  // 	return new SessionItem(session.Item);
  //
  // }

  async saveCICData(sessionId: string, cicData: CicSession): Promise<void> {
  	this.logger.debug(sessionId);
  	const params: any = {
  		TableName: this.tableName,
  		Key: {
  			sessionId,
  		},
  		UpdateExpression: "set fullName = :fullName, dateOfBirth = :dateOfBirth, documentSelected = :documentSelected, dateOfExpiry =:dateOfExpiry",

  		ExpressionAttributeValues: {
  			":fullName": cicData.fullName,
  			":dateOfBirth": cicData.dateOfBirth,
  			":documentSelected": cicData.documentSelected,
  			":dateOfExpiry": cicData.dateOfExpiry,
  		},
  	};

  	this.logger.info("updateItem - updating CIC data in dynamodb" + JSON.stringify(params));
  	try {
  		await this.dynamo.update(params);
  		this.logger.info("updateItem - updated CIC data in dynamodb" + JSON.stringify(params));
  	} catch (error) {
  		this.logger.error("got error " + error);
  		throw new AppError("updateItem - failed ", 500);
  	}
  }

  async setAuthorizationCode(sessionId: string, uuid: string): Promise<void> {
  	this.logger.debug(sessionId);

  	const params: any = {
  		TableName: this.tableName,
  		Key: {
  			sessionId,
  		},
  		UpdateExpression: "set authorizationCode = :authorizationCode, authorizationCodeExpiryDate = :authorizationCodeExpiryDate",

  		ExpressionAttributeValues: {
  			":authorizationCode": uuid,
  			":authorizationCodeExpiryDate": "1894981200",
  		},
  	};

  	this.logger.debug("updateItem - updating authorizationCode dynamodb" + JSON.stringify(params));

  	try {
  		await this.dynamo.update(params);
  		this.logger.info("updateItem - updated authorizationCode in dynamodb" + JSON.stringify(params));
  	} catch (e: any) {
  		this.logger.error("got error " + e);
  		throw new AppError("updateItem - failed ", 500);
  	}
  }
}
