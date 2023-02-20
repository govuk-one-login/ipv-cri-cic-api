"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CicService_1 = require("../../../services/CicService");
const logger_1 = require("@aws-lambda-powertools/logger");
const CicSession_1 = require("../../../models/CicSession");
const crypto_1 = require("crypto");
const DynamoDBFactory_1 = require("../../../utils/DynamoDBFactory");
const HttpCodesEnum_1 = require("../../../utils/HttpCodesEnum");
const logger = new logger_1.Logger({
    logLevel: "DEBUG",
    serviceName: "CIC",
});
let cicService;
const tableName = "MYTABLE";
const sessionId = "SESSID";
const authCode = "AUTHCODE";
const mockDynamoDbClient = jest.mocked((0, DynamoDBFactory_1.createDynamoDbClient)());
const SESSION_RECORD = require("../data/db_record.json");
const FAILURE_VALUE = "throw_me";
describe("Cic Service", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        cicService = new CicService_1.CicService(tableName, logger, mockDynamoDbClient);
    });
    it("Should return a session item when passed a valid session Id", async () => {
        mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item: SESSION_RECORD });
        const result = await cicService.getSessionById(sessionId);
        expect(result).toEqual({ sessionId: "SESSID" });
    });
    it("Should not throw an error and return undefined when session doesn't exist", async () => {
        mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
        return expect(cicService.getSessionById("1234")).resolves.toBeUndefined();
    });
    it("should throw 500 if request fails during save CIC data", async () => {
        mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
        const cicSess = new CicSession_1.CicSession({ given_names: ["Test", "user"], family_names: ["Family", "name"], date_of_birth: "1970-01-01", document_selected: "passport", date_of_expiry: "1970-01-01" });
        return expect(cicService.saveCICData(FAILURE_VALUE, cicSess)).rejects.toThrow(expect.objectContaining({
            statusCode: HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR,
        }));
    });
    it("Should not throw an error and return undefined when set AuthorizationCode CIC data doesn't exist", async () => {
        return expect(cicService.setAuthorizationCode("SESSID", (0, crypto_1.randomUUID)())).resolves.toBeUndefined();
    });
    it("should throw 500 if request fails when setting AuthorizationCode", async () => {
        mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
        return expect(cicService.setAuthorizationCode(FAILURE_VALUE, (0, crypto_1.randomUUID)())).rejects.toThrow(expect.objectContaining({
            statusCode: HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR,
        }));
    });
    it("should throw 500 if request fails during update Session data with access token details", async () => {
        mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
        return expect(cicService.updateSessionWithAccessTokenDetails("SESSID", 12345)).rejects.toThrow(expect.objectContaining({
            statusCode: HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR,
        }));
    });
});
