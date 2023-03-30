"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UserInfoHandler_1 = require("../../UserInfoHandler");
const jest_mock_extended_1 = require("jest-mock-extended");
const userInfo_events_1 = require("./data/userInfo-events");
const UserInfoRequestProcessor_1 = require("../../services/UserInfoRequestProcessor");
const HttpCodesEnum_1 = require("../../utils/HttpCodesEnum");
const mockedUserInfoRequestProcessor = (0, jest_mock_extended_1.mock)();
jest.mock("../../services/UserInfoRequestProcessor", () => {
    return {
        UserInfoRequestProcessor: jest.fn(() => mockedUserInfoRequestProcessor),
    };
});
describe("UserInfoHandler", () => {
    it("return success response for userInfo", async () => {
        UserInfoRequestProcessor_1.UserInfoRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedUserInfoRequestProcessor);
        await (0, UserInfoHandler_1.lambdaHandler)(userInfo_events_1.VALID_USERINFO, "CIC");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockedUserInfoRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
    });
    it("return not found when resource not found", async () => {
        UserInfoRequestProcessor_1.UserInfoRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedUserInfoRequestProcessor);
        return expect((0, UserInfoHandler_1.lambdaHandler)(userInfo_events_1.RESOURCE_NOT_FOUND, "CIC")).rejects.toThrow(expect.objectContaining({
            statusCode: HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND,
        }));
    });
});
