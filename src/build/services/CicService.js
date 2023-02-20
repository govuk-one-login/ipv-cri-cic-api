"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CicService = void 0;
const AppError_1 = require("../utils/AppError");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const HttpCodesEnum_1 = require("../utils/HttpCodesEnum");
const DateTimeUtils_1 = require("../utils/DateTimeUtils");
const Constants_1 = require("../utils/Constants");
const AuthSessionState_1 = require("../models/enums/AuthSessionState");
const SqsClient_1 = require("../utils/SqsClient");
class CicService {
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
    async getSessionById(sessionId) {
        this.logger.debug("Table name " + this.tableName);
        const getSessionCommand = new lib_dynamodb_1.GetCommand({
            TableName: this.tableName,
            Key: {
                sessionId,
            },
        });
        let session;
        try {
            session = await this.dynamo.send(getSessionCommand);
        }
        catch (e) {
            this.logger.error({
                message: "getSessionById - failed executing get from dynamodb:",
                e,
            });
            throw new AppError_1.AppError("Error retrieving Session", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
        if (session.Item) {
            return session.Item;
        }
    }
    async saveCICData(sessionId, cicData) {
        const saveCICCommand = new lib_dynamodb_1.UpdateCommand({
            TableName: this.tableName,
            Key: { sessionId },
            UpdateExpression: "SET given_names = :given_names, family_names = :family_names, date_of_birth = :date_of_birth, document_selected = :document_selected, date_of_expiry =:date_of_expiry, authSessionState = :authSessionState",
            ExpressionAttributeValues: {
                ":given_names": cicData.given_names,
                ":family_names": cicData.family_names,
                ":date_of_birth": cicData.date_of_birth,
                ":document_selected": cicData.document_selected,
                ":date_of_expiry": cicData.date_of_expiry,
                ":authSessionState": AuthSessionState_1.AuthSessionState.CIC_DATA_RECEIVED,
            },
        });
        this.logger.info({
            message: "updating CIC data in dynamodb",
            saveCICCommand,
        });
        try {
            await this.dynamo.send(saveCICCommand);
            this.logger.info({ message: "updated CIC data in dynamodb" });
        }
        catch (error) {
            this.logger.error({ message: "got error saving CIC data", error });
            throw new AppError_1.AppError("Failed to set claimed identity data ", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
    }
    async setAuthorizationCode(sessionId, uuid) {
        const updateSessionCommand = new lib_dynamodb_1.UpdateCommand({
            TableName: this.tableName,
            Key: { sessionId },
            UpdateExpression: "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry, authSessionState = :authSessionState",
            ExpressionAttributeValues: {
                ":authCode": uuid,
                ":authCodeExpiry": (0, DateTimeUtils_1.getAuthorizationCodeExpirationEpoch)(process.env.AUTHORIZATION_CODE_TTL),
                ":authSessionState": AuthSessionState_1.AuthSessionState.CIC_AUTH_CODE_ISSUED,
            },
        });
        this.logger.info({
            message: "updating authorizationCode dynamodb",
            updateSessionCommand,
        });
        try {
            await this.dynamo.send(updateSessionCommand);
            this.logger.info({ message: "updated authorizationCode in dynamodb" });
        }
        catch (e) {
            this.logger.error({ message: "got error setting auth code", e });
            throw new AppError_1.AppError("Failed to set authorization code ", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
    }
    async sendToTXMA(event) {
        const messageBody = JSON.stringify(event);
        const params = {
            MessageBody: messageBody,
            QueueUrl: process.env.TXMA_QUEUE_URL,
        };
        this.logger.info({ message: "Sending message to TxMA", messageBody });
        try {
            await SqsClient_1.sqsClient.send(new SqsClient_1.SendMessageCommand(params));
            this.logger.info("Sent message to TxMA");
        }
        catch (error) {
            this.logger.error("got error " + error);
            throw new AppError_1.AppError("sending event - failed ", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
    }
    async getSessionByAuthorizationCode(code) {
        const params = {
            TableName: this.tableName,
            IndexName: Constants_1.Constants.AUTHORIZATION_CODE_INDEX_NAME,
            KeyConditionExpression: "authorizationCode = :authorizationCode",
            ExpressionAttributeValues: {
                ":authorizationCode": code,
            },
        };
        const sessionItem = await this.dynamo.query(params);
        if (!sessionItem?.Items || sessionItem?.Items?.length !== 1) {
            throw new AppError_1.AppError("Error retrieving Session by authorization code", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
        return sessionItem.Items[0];
    }
    async updateSessionWithAccessTokenDetails(sessionId, accessTokenExpiryDate) {
        const updateAccessTokenDetailsCommand = new lib_dynamodb_1.UpdateCommand({
            TableName: this.tableName,
            Key: { sessionId },
            UpdateExpression: "SET authSessionState = :authSessionState, accessTokenExpiryDate = :accessTokenExpiryDate REMOVE authorizationCode",
            ExpressionAttributeValues: {
                ":authSessionState": AuthSessionState_1.AuthSessionState.CIC_ACCESS_TOKEN_ISSUED,
                ":accessTokenExpiryDate": accessTokenExpiryDate,
            },
        });
        this.logger.info({
            message: "updating Access token details in dynamodb",
            updateAccessTokenDetailsCommand,
        });
        try {
            await this.dynamo.send(updateAccessTokenDetailsCommand);
            this.logger.info({ message: "updated Access token details in dynamodb" });
        }
        catch (error) {
            this.logger.error({
                message: "got error saving Access token details",
                error,
            });
            throw new AppError_1.AppError("updateItem - failed: got error saving Access token details", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
    }
    async createAuthSession(session) {
        const putSessionCommand = new lib_dynamodb_1.PutCommand({
            TableName: this.tableName,
            Item: session,
        });
        this.logger.info({
            message: "Saving session data in DynamoDB: " +
                JSON.stringify([putSessionCommand]),
        });
        try {
            await this.dynamo.send(putSessionCommand);
            this.logger.info("Successfully created session in dynamodb");
        }
        catch (error) {
            this.logger.error("got error " + error);
            throw new AppError_1.AppError("saveItem - failed ", 500);
        }
    }
    mapAddresses(addresses) {
        return addresses?.map((address) => ({
            uprn: address.uprn,
            organisationName: address.organisationName,
            departmentName: address.departmentName,
            subBuildingName: address.subBuildingName,
            buildingNumber: address.buildingNumber,
            buildingName: address.buildingName,
            dependentStreetName: address.dependentStreetName,
            streetName: address.streetName,
            addressCountry: address.addressCountry,
            postalCode: address.postalCode,
            addressLocality: address.addressLocality,
            dependentAddressLocality: address.dependentAddressLocality,
            doubleDependentAddressLocality: address.doubleDependentAddressLocality,
            validFrom: address.validFrom,
            validUntil: address.validUntil,
        }));
    }
    mapBirthDates(birthDates) {
        return birthDates?.map((bd) => ({ value: bd.value }));
    }
    mapNames(names) {
        return names?.map((name) => ({
            nameParts: name?.nameParts?.map((namePart) => ({
                type: namePart.type,
                value: namePart.value,
            })),
        }));
    }
    createPersonIdentityItem(sharedClaims, sessionId, sessionExpirationEpoch) {
        return {
            sessionId,
            addresses: this.mapAddresses(sharedClaims.address),
            birthDates: this.mapBirthDates(sharedClaims.birthDate),
            expiryDate: sessionExpirationEpoch,
            names: this.mapNames(sharedClaims.name),
        };
    }
    async savePersonIdentity(sharedClaims, sessionId, expiryDate) {
        const personIdentityItem = this.createPersonIdentityItem(sharedClaims, sessionId, expiryDate);
        const putSessionCommand = new lib_dynamodb_1.PutCommand({
            TableName: process.env.PERSON_IDENTITY_TABLE_NAME,
            Item: personIdentityItem,
        });
        await this.dynamo.send(putSessionCommand);
        return putSessionCommand?.input?.Item?.sessionId;
    }
}
exports.CicService = CicService;
