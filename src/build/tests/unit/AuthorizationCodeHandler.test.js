"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AuthorizationCodeHandler_1 = require("../../AuthorizationCodeHandler");
const jest_mock_extended_1 = require("jest-mock-extended");
const auth_events_1 = require("./data/auth-events");
const Response_1 = require("../../utils/Response");
const HttpCodesEnum_1 = require("../../utils/HttpCodesEnum");
const AuthorizationRequestProcessor_1 = require("../../services/AuthorizationRequestProcessor");
const mockedAuthorizationRequestProcessor = (0, jest_mock_extended_1.mock)();
jest.mock("../../services/AuthorizationRequestProcessor", () => {
    return {
        AuthorizationRequestProcessor: jest.fn(() => mockedAuthorizationRequestProcessor),
    };
});
describe("AuthorizationCodeHandler", () => {
    it("return success response for AuthorizationCode", async () => {
        AuthorizationRequestProcessor_1.AuthorizationRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAuthorizationRequestProcessor);
        await (0, AuthorizationCodeHandler_1.lambdaHandler)(auth_events_1.VALID_AUTHCODE, "AUTH_CODE");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockedAuthorizationRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
    });
    it("return not found when unsupported http method tried for authorization", async () => {
        AuthorizationRequestProcessor_1.AuthorizationRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAuthorizationRequestProcessor);
        return expect((0, AuthorizationCodeHandler_1.lambdaHandler)(auth_events_1.UNSUPPORTED_AUTHCODE, "CIC")).resolves.toEqual(new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND, ""));
    });
    it("return not found when resource not found", async () => {
        AuthorizationRequestProcessor_1.AuthorizationRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAuthorizationRequestProcessor);
        return expect((0, AuthorizationCodeHandler_1.lambdaHandler)(auth_events_1.RESOURCE_NOT_FOUND, "AUTH_CODE")).rejects.toThrow(expect.objectContaining({
            statusCode: HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND,
        }));
    });
});
