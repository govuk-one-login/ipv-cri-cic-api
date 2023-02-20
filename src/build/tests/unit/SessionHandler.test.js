"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SessionHandler_1 = require("../../SessionHandler");
const jest_mock_extended_1 = require("jest-mock-extended");
const session_events_1 = require("./data/session-events");
const SessionRequestProcessor_1 = require("../../services/SessionRequestProcessor");
const mockedSessionRequestProcessor = (0, jest_mock_extended_1.mock)();
jest.mock("../../services/SessionRequestProcessor", () => {
    return {
        SessionRequestProcessor: jest.fn(() => mockedSessionRequestProcessor),
    };
});
describe("SessionHandler", () => {
    it("return success response for session", async () => {
        SessionRequestProcessor_1.SessionRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionRequestProcessor);
        await (0, SessionHandler_1.lambdaHandler)(session_events_1.VALID_SESSION, "CIC");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockedSessionRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
    });
});
