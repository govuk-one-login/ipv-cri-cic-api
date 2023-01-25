/* eslint-disable no-console */
import { CicSession } from "../models/CicSession";
import { SessionItem } from "../models/SessionItem";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { StatusCodes } from "http-status-codes";

export class CicService {
  readonly tableName: string;

  private readonly dynamo: DocumentClient;

  readonly logger: Logger;

  private static instance: CicService;

  constructor(tableName: any, logger: Logger) {
  	// throw error if tableName iss null
  	this.tableName = tableName;
  	this.dynamo = new DocumentClient();
  	this.logger = logger;
  }

  static getInstance(tableName: string, logger: Logger): CicService {
  	if (!CicService.instance) {
  		CicService.instance = new CicService(tableName, logger);
  	}
  	return CicService.instance;
  }

  async getSessionById(sessionId: string): Promise<SessionItem | undefined> {
  	let session;
  	this.logger.debug("Table name " + this.tableName);
  	this.logger.debug("Sesssion id " + sessionId);
  	try {
  		const params = {
  			TableName: this.tableName,
  			Key: {
  				sessionId,
  			},
  		};
  		session = await this.dynamo.get(params).promise();
  		if (session) {
  			return new SessionItem(session?.Item);
  		} else {
  			this.logger.debug("no session found");
  		}
  	} catch (error) {
  		this.logger.error("Got error", error as Error);
  		throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "Error getting session from database: " + error);

  		// throw new DatabaseConnectionError('Error getting session from database')
  	}
  }

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
  		await this.dynamo.update(params).promise();
  		this.logger.info("updateItem - updated CIC data in dynamodb" + JSON.stringify(params));
  	} catch (error) {
  		this.logger.error("got error " + error);
  		throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "updateItem - failed ");
  	}
  }

  async setAuthorizationCode(sessionId: string, uuid: string): Promise<void> {
  	this.logger.debug(sessionId);

  	const params: any = {
  		TableName: process.env.SESSION_TABLE_NAME!,
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
  		await this.dynamo.update(params).promise();
  		this.logger.info("updateItem - updated authorizationCode in dynamodb" + JSON.stringify(params));
  	} catch (e: any) {
  		this.logger.error("got error " + e);
  		throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "updateItem - failed ");
  	}
  }
}
