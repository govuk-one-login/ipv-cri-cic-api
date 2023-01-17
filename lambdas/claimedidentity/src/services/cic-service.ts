/* eslint-disable no-console */
import { CICSession } from "../models/CICSession";
import {SessionItem} from "../models/SessionItem";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

export class CICService {
    readonly tableName: string
    private readonly dynamo: DocumentClient;

    constructor(tableName: any ) {
        //throw error if tableName iss null
        this.tableName = tableName
        this.dynamo = new DocumentClient();
    }

    async getSessionById (sessionId: string ): Promise<SessionItem> {
        let session
        console.log("Table name "+this.tableName)
        console.log("Sesssion id "+sessionId)
        try {
            const params = {
                TableName: process.env.SESSION_TABLE_NAME!,
                Key: {
                    sessionId: sessionId
                }
            }
            session = await this.dynamo.get(params).promise()

        } catch (error) {
            console.log(error)
            //this._logger.error('Error getting session from database', {error})
            //throw new DatabaseConnectionError('Error getting session from database')
        }
        if (!session?.Item) {
            console.log("no session found")

           // LoggingHelper.get().error("getTestById - no test found", DynamoDAO.name, HttpCodesEnum.NOT_FOUND, response, AppCodes.E1006);
            //throw new AppError(HttpCodesEnum.NOT_FOUND, "Test was not found", AppCodes.E1006, { testId });
        }
        return new SessionItem(session?.Item);
    }

    public async saveCICData(sessionId: string, cicData: CICSession): Promise<void> {
        console.log(sessionId)
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

        console.log("******" +JSON.stringify(params))

        //LoggingHelper.get().info("updateItem - updating dynamodb", DynamoDAO.name, params);
        let response;
        try {
            response = await this.dynamo.update(params).promise();

        } catch (e: any) {
            console.log("**** got error "+e)
            //LoggingHelper.get().error("updateItem - failed executing update to dynamodb", DynamoDAO.name, e?.statusCode, e, AppCodes.E6010);
            //throw new AppError(HttpCodesEnum.SERVER_ERROR, "Error updating Test", AppCodes.E6010);
        }
    }
}
