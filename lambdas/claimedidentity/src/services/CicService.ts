/* eslint-disable no-console */
import { CicSession } from "../models/CicSession";
import {SessionItem} from "../models/SessionItem";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { Logger } from '@aws-lambda-powertools/logger';
import { AppError } from "../utils/AppError";
import { StatusCodes } from "http-status-codes";
import {Metrics} from "@aws-lambda-powertools/metrics";

export class CicService {
    readonly tableName: string
    private readonly dynamo: DocumentClient;
    readonly logger: Logger;
    private static instance: CicService;

    constructor(tableName: any, logger: Logger ) {
        //throw error if tableName iss null
        this.tableName = tableName;
        this.dynamo = new DocumentClient();
        this.logger = logger;
    }

    static getInstance(tableName: string, logger: Logger): CicService {
        if (!CicService.instance) {
            CicService.instance = new CicService( tableName, logger);
        }
        return CicService.instance;
    }

    public async getSessionById (sessionId: string ): Promise<SessionItem | undefined> {
        let session
        this.logger.debug("Table name "+this.tableName)
        this.logger.debug("Sesssion id "+sessionId)
        try {
            const params = {
                TableName: process.env.SESSION_TABLE_NAME!,
                Key: {
                    sessionId: sessionId
                }
            }
            session = await this.dynamo.get(params).promise()
            return session.Item ? (session.Item as unknown as SessionItem) : undefined;

        } catch (error) {
            this.logger.error("Got error" , error as Error)
            throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "Error getting session from database");

            //this._logger.error('Error getting session from database', {error})
            //throw new DatabaseConnectionError('Error getting session from database')
        }
        if (!session?.Item) {
            this.logger.debug("no session found")

           // LoggingHelper.get().error("getTestById - no test found", DynamoDAO.name, HttpCodesEnum.NOT_FOUND, response, AppCodes.E1006);
            //throw new AppError(HttpCodesEnum.NOT_FOUND, "Test was not found", AppCodes.E1006, { testId });
        }
        return new SessionItem(session?.Item);
    }

    public async saveCICData(sessionId: string, cicData: CicSession): Promise<void> {
        this.logger.debug(sessionId)
        let params: any = {
            TableName: process.env.SESSION_TABLE_NAME!,
            Key: {
                sessionId: sessionId
            },
            UpdateExpression: "set fullName = :fullName, dateOfBirth = :dateOfBirth, documentSelected = :documentSelected, dateOfExpiry =:dateOfExpiry",

            ExpressionAttributeValues: {
                ":fullName": cicData.fullName,
                ":dateOfBirth": cicData.dateOfBirth,
                ":documentSelected": cicData.documentSelected,
                ":dateOfExpiry": cicData.dateOfExpiry
            }
        }

        this.logger.debug("******" +JSON.stringify(params))

        //LoggingHelper.get().info("updateItem - updating dynamodb", DynamoDAO.name, params);
        let response;
        try {
            response = await this.dynamo.update(params).promise();

        } catch (e: any) {
            this.logger.error("**** got error "+e)
            throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "updateItem - failed ")
            //LoggingHelper.get().error("updateItem - failed executing update to dynamodb", DynamoDAO.name, e?.statusCode, e, AppCodes.E6010);
            //throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating Test", AppCodes.E6010);
        }
    }

    public async createAuthorizationCode(sessionId: string, uuid: string): Promise<void> {
        this.logger.debug(sessionId)

        let params: any = {
            TableName: process.env.SESSION_TABLE_NAME!,
            Key: {
                sessionId: sessionId
            },
            UpdateExpression: "set authorizationCode = :authorizationCode, authorizationCodeExpiryDate = :authorizationCodeExpiryDate",

            ExpressionAttributeValues: {
                ":authorizationCode": uuid,
                ":authorizationCodeExpiryDate": "1894981200"
            }
        }

        this.logger.debug("******" +JSON.stringify(params))

        //LoggingHelper.get().info("updateItem - updating dynamodb", DynamoDAO.name, params);
        try {
            await this.dynamo.update(params).promise();

        } catch (e: any) {
            this.logger.error("**** got error "+e)
            throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "updateItem - failed ")
            //LoggingHelper.get().error("updateItem - failed executing update to dynamodb", DynamoDAO.name, e?.statusCode, e, AppCodes.E6010);
            //throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating Test", AppCodes.E6010);
        }
    }

}
