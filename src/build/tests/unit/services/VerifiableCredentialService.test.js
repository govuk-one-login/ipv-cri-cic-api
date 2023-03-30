"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UserInfoRequestProcessor_1 = require("../../../services/UserInfoRequestProcessor");
const metrics_1 = require("@aws-lambda-powertools/metrics");
const jest_mock_extended_1 = require("jest-mock-extended");
const HttpCodesEnum_1 = require("../../../utils/HttpCodesEnum");
const DateTimeUtils_1 = require("../../../utils/DateTimeUtils");
const MockJwtVerifierSigner_1 = require("../utils/MockJwtVerifierSigner");
const verified_credential_1 = require("../data/verified_credential");
const userInfo_events_1 = require("../data/userInfo-events");
const ValidationHelper_1 = require("../../../utils/ValidationHelper");
let userInforequestProcessorTest;
const mockCicService = (0, jest_mock_extended_1.mock)();
let mockSession;
const passingKmsJwtAdapterFactory = (_signingKeys) => new MockJwtVerifierSigner_1.MockKmsJwtAdapterForVc(true);
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
        given_names: ["FRED", "NICK"],
        family_names: ["OTHER", "NAME"],
        date_of_birth: "01-01-1960",
        document_selected: "brp",
        date_of_expiry: "23-04-2024",
        authSessionState: "CIC_ACCESS_TOKEN_ISSUED",
    };
    return sess;
}
describe("Issuing verified credentials", () => {
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
        const expectedJwt = verified_credential_1.VALID_VC;
        expectedJwt.iat = (0, DateTimeUtils_1.absoluteTimeNow)();
        expectedJwt.nbf = (0, DateTimeUtils_1.absoluteTimeNow)();
        // @ts-ignore
        userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.OK);
        const actualJwt = JSON.parse(JSON.parse(out.body)["https://vocab.account.gov.uk/v1/credentialJWT"]);
        //Setting the actualJwt jti to mock value to pass test
        actualJwt.jti = "uuid";
        expect(actualJwt).toEqual(expectedJwt);
    });
    it("Verify jti claim in the generated VC is a valid UUID", async () => {
        mockCicService.getSessionById.mockResolvedValue(mockSession);
        // @ts-ignore
        userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.OK);
        const actualJwt = JSON.parse(JSON.parse(out.body)["https://vocab.account.gov.uk/v1/credentialJWT"]);
        expect(new ValidationHelper_1.ValidationHelper().isValidUUID(actualJwt.jti)).toBeTruthy();
    });
    it.each([
        [["FRED", "NICK"], ["FAMILY"], 3],
        [["FRED"], ["FAMILY"], 2],
        [["FRED", "NICK"], ["FAMILY", "NAME"], 4],
        [["FRED", "NICK", "JAMES"], ["FAMILY", "NAME"], 5],
    ])("Return successful response with 200 OK and verify length of name parts in the VC", async (givenName, familyName, expectedLength) => {
        // @ts-ignore
        mockSession.given_names = givenName;
        // @ts-ignore
        mockSession.family_names = familyName;
        mockCicService.getSessionById.mockResolvedValue(mockSession);
        // @ts-ignore
        userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();
        const out = await userInforequestProcessorTest.processRequest(userInfo_events_1.VALID_USERINFO);
        expect(out.statusCode).toBe(HttpCodesEnum_1.HttpCodesEnum.OK);
        const actualJwt = JSON.parse(JSON.parse(out.body)["https://vocab.account.gov.uk/v1/credentialJWT"]);
        const nameParts = actualJwt.vc.credentialSubject.name[0].nameParts;
        expect(nameParts).toHaveLength(expectedLength);
    });
});
