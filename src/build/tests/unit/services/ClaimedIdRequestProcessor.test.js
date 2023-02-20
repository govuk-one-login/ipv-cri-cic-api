"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClaimedIdRequestProcessor_1 = require("../../../services/ClaimedIdRequestProcessor");
const metrics_1 = require("@aws-lambda-powertools/metrics");
const jest_mock_extended_1 = require("jest-mock-extended");
const logger_1 = require("@aws-lambda-powertools/logger");
const cic_events_1 = require("../data/cic-events");
const HttpCodesEnum_1 = require("../../../utils/HttpCodesEnum");
const AuthSessionState_1 = require("../../../models/enums/AuthSessionState");
let claimedIdRequestProcessorTest;
const mockCicService = (0, jest_mock_extended_1.mock)();
const logger = new logger_1.Logger({
    logLevel: "DEBUG",
    serviceName: "CIC",
});
const metrics = new metrics_1.Metrics({ namespace: "CIC" });
function getMockSessionItem() {
    const sess = {
        sessionId: "sdfsdg",
        clientId: "ipv-core-stub",
        accessToken: "AbCdEf123456",
        clientSessionId: "sdfssg",
        authorizationCode: "",
        authorizationCodeExpiryDate: 0,
        redirectUri: "http://localhost:8085/callback",
        accessTokenExpiryDate: 0,
        expiryDate: 221848913376,
        createdDate: 1675443004,
        state: "Y@atr",
        subject: "sub",
        persistentSessionId: "sdgsdg",
        clientIpAddress: "127.0.0.1",
        attemptCount: 1,
        given_names: ["given", "name"],
        family_names: ["family", "name"],
        date_of_birth: "09-08-1961",
        document_selected: "Passport",
        date_of_expiry: "23-04-1027",
        authSessionState: AuthSessionState_1.AuthSessionState.CIC_SESSION_CREATED,
    };
    return sess;
}
describe("ClaimedIdRequestProcessor", () => {
    beforeAll(() => {
        claimedIdRequestProcessorTest = new ClaimedIdRequestProcessor_1.ClaimedIdRequestProcessor(logger, metrics);
        // @ts-ignore
        claimedIdRequestProcessorTest.cicService = mockCicService;
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it("Return successful response with 200 OK when session is found", async () => {
        const sess = getMockSessionItem();
        mockCicService.getSessionById.mockResolvedValue(sess);
        const out = await claimedIdRequestProcessorTest.processRequest(cic_events_1.VALID_CLAIMEDID, "1234");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        expect(out.body).toBe("");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.OK);
    });
    it("Return 401 when session is expired", async () => {
        const sess = getMockSessionItem();
        sess.expiryDate = 1675458564;
        mockCicService.getSessionById.mockResolvedValue(sess);
        const out = await claimedIdRequestProcessorTest.processRequest(cic_events_1.VALID_CLAIMEDID, "1234");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        expect(out.body).toBe("Session with session id: 1234 has expired");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
    });
    it("Return 401 when session with that session id not found in the DB", async () => {
        mockCicService.getSessionById.mockResolvedValue(undefined);
        const out = await claimedIdRequestProcessorTest.processRequest(cic_events_1.VALID_CLAIMEDID, "1234");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        expect(out.body).toBe("No session found with the session id: 1234");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
    });
});
