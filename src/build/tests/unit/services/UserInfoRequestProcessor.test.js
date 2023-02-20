"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UserInfoRequestProcessor_1 = require("../../../services/UserInfoRequestProcessor");
const metrics_1 = require("@aws-lambda-powertools/metrics");
const jest_mock_extended_1 = require("jest-mock-extended");
const userInfo_events_1 = require("../data/userInfo-events");
const HttpCodesEnum_1 = require("../../../utils/HttpCodesEnum");
const DateTimeUtils_1 = require("../../../utils/DateTimeUtils");
const MockJwtVerifierSigner_1 = require("../utils/MockJwtVerifierSigner");
let userInforequestProcessorTest;
const mockCicService = (0, jest_mock_extended_1.mock)();
let mockSession;
const passingKmsJwtAdapterFactory = (_signingKeys) => new MockJwtVerifierSigner_1.MockKmsJwtAdapter(true);
const failingKmsJwtAdapterFactory = (_signingKeys) => new MockJwtVerifierSigner_1.MockKmsJwtAdapter(false);
const failingKmsJwtSigningAdapterFactory = (_signingKeys) => new MockJwtVerifierSigner_1.MockFailingKmsSigningJwtAdapter();
const logger = (0, jest_mock_extended_1.mock)();
const metrics = new metrics_1.Metrics({ namespace: "CIC" });
function getMockSessionItem() {
    const sess = {
        sessionId: "sdfsdg",
        clientId: "ipv-core-stub",
        accessToken: "AbCdEf123456",
        clientSessionId: "sdfssg",
        authorizationCode: "",
        authorizationCodeExpiryDate: 123,
        redirectUri: "http",
        accessTokenExpiryDate: 1234,
        expiryDate: 123,
        createdDate: 123,
        state: "initial",
        subject: "sub",
        persistentSessionId: "sdgsdg",
        clientIpAddress: "127.0.0.1",
        attemptCount: 1,
        given_names: ["given", "name"],
        family_names: ["family", "name"],
        date_of_birth: "09-08-1961",
        document_selected: "Passport",
        date_of_expiry: "23-04-1027",
        authSessionState: "CIC_ACCESS_TOKEN_ISSUED",
    };
    return sess;
}
describe("UserInfoRequestProcessor", () => {
    beforeAll(() => {
        mockSession = getMockSessionItem();
        userInforequestProcessorTest = new UserInfoRequestProcessor_1.UserInfoRequestProcessor(logger, metrics);
        // @ts-ignore
        userInforequestProcessorTest.cicService = mockCicService;
    });
    beforeEach(() => {
        jest.clearAllMocks();
        // @ts-ignore
        userInforequestProcessorTest.kmsJwtAdapter = passingKmsJwtAdapterFactory();
        mockSession = getMockSessionItem();
    });
    it("Return successful response with 200 OK when user data is found for an accessToken", async () => {
        mockCicService.getSessionById.mockResolvedValue(mockSession);
        // @ts-ignore
        userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.sendToTXMA).toHaveBeenCalledTimes(1);
        expect(out.body).toEqual(JSON.stringify({
            sub: "ipv-core-stub",
            "https://vocab.account.gov.uk/v1/credentialJWT": ["signedJwt-test"],
        }));
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.OK);
    });
    it("Return 401 when Authorization header is missing in the request", async () => {
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.MISSING_AUTH_HEADER_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        // @ts-ignore
        expect(out.body).toBe("Failed to Validate - Authentication header: Missing header: Authorization header value is missing or invalid auth_scheme");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
    });
    it("Return 401 when access_token JWT validation fails", async () => {
        // @ts-ignore
        userInforequestProcessorTest.kmsJwtAdapter = failingKmsJwtAdapterFactory();
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        // @ts-ignore
        expect(out.body).toBe("Failed to Validate - Authentication header: Verification of JWT failed");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
    });
    it("Return 401 when sub is missing from JWT access_token", async () => {
        // @ts-ignore
        userInforequestProcessorTest.kmsJwtAdapter.mockJwt.payload.sub = null;
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        // @ts-ignore
        expect(out.body).toBe("Failed to Validate - Authentication header: sub missing");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
    });
    it("Return 401 when we receive expired JWT access_token", async () => {
        // @ts-ignore
        userInforequestProcessorTest.kmsJwtAdapter.mockJwt.payload.exp = (0, DateTimeUtils_1.absoluteTimeNow)() - 500;
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        // @ts-ignore
        expect(out.body).toBe("Failed to Validate - Authentication header: Verification of exp failed");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
    });
    it("Return 401 when session (based upon sub) was not found in the DB", async () => {
        mockCicService.getSessionById.mockResolvedValue(undefined);
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        expect(out.body).toContain("No session found with the sessionId: ");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
    });
    it.each([
        "given_names",
        "family_names",
        "date_of_birth",
        "document_selected",
        "date_of_expiry",
    ])("when %s userInfo data is missing - will return error", async (userInfoData) => {
        // @ts-ignore
        mockSession[userInfoData] = "";
        mockCicService.getSessionById.mockResolvedValue(mockSession);
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        expect(out.body).toBe("Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
    });
    it("Return 401 when AuthSessionState is not CIC_ACCESS_TOKEN_ISSUED", async () => {
        mockCicService.getSessionById.mockResolvedValue(mockSession);
        mockSession.authSessionState = "CIC_AUTH_CODE_ISSUED";
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        expect(out.body).toContain("AuthSession is in wrong Auth state: Expected state- CIC_ACCESS_TOKEN_ISSUED, actual state- CIC_AUTH_CODE_ISSUED");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
    });
    it("Return 500 when Failed to sign the verifiableCredential Jwt", async () => {
        mockCicService.getSessionById.mockResolvedValue(mockSession);
        // @ts-ignore
        userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = failingKmsJwtSigningAdapterFactory();
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        expect(out.body).toContain("Failed to sign the verifiableCredential Jwt");
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
    });
    it("Return successful response with 200 OK when write to txMA fails", async () => {
        mockCicService.getSessionById.mockResolvedValue(mockSession);
        mockCicService.sendToTXMA.mockRejectedValue({});
        // @ts-ignore
        userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockCicService.sendToTXMA).toHaveBeenCalledTimes(1);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(logger.error).toHaveBeenCalledWith("Failed to write TXMA event CIC_CRI_VC_ISSUED to SQS queue.");
        expect(out.body).toEqual(JSON.stringify({
            sub: "ipv-core-stub",
            "https://vocab.account.gov.uk/v1/credentialJWT": ["signedJwt-test"],
        }));
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.OK);
    });
});
