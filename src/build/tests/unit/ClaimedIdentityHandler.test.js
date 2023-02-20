"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClaimedIdentityHandler_1 = require("../../ClaimedIdentityHandler");
const jest_mock_extended_1 = require("jest-mock-extended");
const cic_events_1 = require("./data/cic-events");
const ClaimedIdRequestProcessor_1 = require("../../services/ClaimedIdRequestProcessor");
const Response_1 = require("../../utils/Response");
const HttpCodesEnum_1 = require("../../utils/HttpCodesEnum");
const mockedClaimedIdRequestProcessor = (0, jest_mock_extended_1.mock)();
jest.mock("../../services/ClaimedIdRequestProcessor", () => {
    return {
        ClaimedIdRequestProcessor: jest.fn(() => mockedClaimedIdRequestProcessor),
    };
});
describe("ClaimedIdentityHandler", () => {
    it("return success response for claimedidentity", async () => {
        ClaimedIdRequestProcessor_1.ClaimedIdRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedClaimedIdRequestProcessor);
        await (0, ClaimedIdentityHandler_1.lambdaHandler)(cic_events_1.VALID_CLAIMEDID, "CIC");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockedClaimedIdRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
    });
    it("return not found when unsupported http method tried for claimedidentity", async () => {
        ClaimedIdRequestProcessor_1.ClaimedIdRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedClaimedIdRequestProcessor);
        return expect((0, ClaimedIdentityHandler_1.lambdaHandler)(cic_events_1.UNSUPPORTED_CLAIMEDID, "CIC")).resolves.toEqual(new Response_1.Response(HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND, ""));
    });
    it("return not found when resource not found", async () => {
        ClaimedIdRequestProcessor_1.ClaimedIdRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedClaimedIdRequestProcessor);
        return expect((0, ClaimedIdentityHandler_1.lambdaHandler)(cic_events_1.RESOURCE_NOT_FOUND, "CIC")).rejects.toThrow(expect.objectContaining({
            statusCode: HttpCodesEnum_1.HttpCodesEnum.NOT_FOUND,
        }));
    });
});
