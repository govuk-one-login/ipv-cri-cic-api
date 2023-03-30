"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jest_mock_extended_1 = require("jest-mock-extended");
const HttpCodesEnum_1 = require("../../utils/HttpCodesEnum");
const AccessTokenRequestProcessor_1 = require("../../services/AccessTokenRequestProcessor");
const AccessTokenHandler_1 = require("../../AccessTokenHandler");
const accessToken_events_1 = require("./data/accessToken-events");
const mockedAccessTokenRequestProcessor = (0, jest_mock_extended_1.mock)();
jest.mock("../../services/AccessTokenRequestProcessor", () => {
    return {
        AccessTokenRequestProcessor: jest.fn(() => mockedAccessTokenRequestProcessor),
    };
});
describe("AccessTokenHandler", () => {
    it("return success response for accessToken", async () => {
        AccessTokenRequestProcessor_1.AccessTokenRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAccessTokenRequestProcessor);
        await (0, AccessTokenHandler_1.lambdaHandler)(accessToken_events_1.VALID_ACCESSTOKEN, "CIC");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockedAccessTokenRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
    });
    it("return not found when resource not found", async () => {
        AccessTokenRequestProcessor_1.AccessTokenRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAccessTokenRequestProcessor);
        return expect((0, AccessTokenHandler_1.lambdaHandler)(accessToken_events_1.RESOURCE_NOT_FOUND, "CIC")).rejects.toThrow(expect.objectContaining({
            statusCode: HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND,
        }));
    });
});
