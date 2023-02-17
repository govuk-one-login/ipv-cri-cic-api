var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { AppError } from "../utils/AppError";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { getAuthorizationCodeExpirationEpoch } from "../utils/DateTimeUtils";
export class CicService {
    constructor(tableName, logger, dynamoDbClient) {
        this.tableName = tableName;
        this.dynamo = dynamoDbClient;
        this.logger = logger;
    }
    static getInstance(tableName, logger, dynamoDbClient) {
        if (!CicService.instance) {
            CicService.instance = new CicService(tableName, logger, dynamoDbClient);
        }
        return CicService.instance;
    }
    getSessionById(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.debug("Table name " + this.tableName);
            const getSessionCommand = new GetCommand({
                TableName: this.tableName,
                Key: {
                    sessionId,
                },
            });
            let session;
            try {
                session = yield this.dynamo.send(getSessionCommand);
            }
            catch (e) {
                this.logger.error({ message: "getSessionById - failed executing get from dynamodb:", e });
                throw new AppError("Error retrieving Session", HttpCodesEnum.SERVER_ERROR);
            }
            if (session.Item) {
                return session.Item;
            }
        });
    }
    saveCICData(sessionId, cicData) {
        return __awaiter(this, void 0, void 0, function* () {
            const saveCICCommand = new UpdateCommand({
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
            this.logger.info({ message: "updating CIC data in dynamodb", saveCICCommand });
            try {
                yield this.dynamo.send(saveCICCommand);
                this.logger.info({ message: "updated CIC data in dynamodb" });
            }
            catch (error) {
                this.logger.error({ message: "got error saving CIC data", error });
                throw new AppError("updateItem - failed ", 500);
            }
        });
    }
    setAuthorizationCode(sessionId, uuid) {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield this.dynamo.send(updateSessionCommand);
                this.logger.info({ message: "updated authorizationCode in dynamodb" });
            }
            catch (e) {
                this.logger.error({ message: "got error setting auth code", e });
                throw new AppError("updateItem - failed ", 500);
            }
        });
    }
}
