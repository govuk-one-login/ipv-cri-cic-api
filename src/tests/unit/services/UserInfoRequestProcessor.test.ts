import { UserInfoRequestProcessor } from "../../../services/UserInfoRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { MISSING_AUTH_HEADER_USERINFO, VALID_USERINFO } from "../data/userInfo-events";
import { CicService } from "../../../services/CicService";
import { Response } from "../../../utils/Response";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { ISessionItem } from "../../../models/ISessionItem";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { MockKmsJwtAdapter } from "../utils/MockJwtVerifierSigner";

let userInforequestProcessorTest: UserInfoRequestProcessor;
const mockCicService = mock<CicService>();
let mockSession : ISessionItem;
const passingKmsJwtAdapterFactory = (_signingKeys: string) => new MockKmsJwtAdapter(true);
const failingKmsJwtAdapterFactory = (_signingKeys: string) => new MockKmsJwtAdapter(false);


const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CIC",
});
const metrics = new Metrics({ namespace: "CIC" });

function getMockSessionItem() : ISessionItem {
	const sess: ISessionItem = {
		sessionId : "sdfsdg",
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
		full_name: "test user",
		date_of_birth: "09-08-1961",
		document_selected: "Passport",
		date_of_expiry: "23-04-1027",
	};
	return sess;
}

describe("UserInfoRequestProcessor", () => {
	beforeAll(() => {
		mockSession = getMockSessionItem();
		userInforequestProcessorTest = new UserInfoRequestProcessor(logger, metrics);
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

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);

		expect(out.body).toEqual(JSON.stringify({
			sub: "ipv-core-stub",
			"https://vocab.account.gov.uk/v1/credentialJWT": ["signedJwt-test"],
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});

	it("Return 400 when Authorization header is missing in the request", async () => {
		const out: Response = await userInforequestProcessorTest.processRequest(MISSING_AUTH_HEADER_USERINFO);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		// @ts-ignore
		expect(out.body).toBe("Failed to Validate - Authentication header: Missing header: Authorization header value is missing or invalid auth_scheme");
		expect(out.statusCode).toBe(HttpCodesEnum.BAD_REQUEST);
	});

	it("Return 400 when access_token JWT validation fails", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter = failingKmsJwtAdapterFactory();
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		// @ts-ignore
		expect(out.body).toBe("Failed to Validate - Authentication header: Verification of JWT failed");
		expect(out.statusCode).toBe(HttpCodesEnum.BAD_REQUEST);
	});

	it("Return 400 when sub is missing from JWT access_token", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter.mockJwt.payload.sub = null;
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		// @ts-ignore
		expect(out.body).toBe("Failed to Validate - Authentication header: sub missing");
		expect(out.statusCode).toBe(HttpCodesEnum.BAD_REQUEST);
	});

	it("Return 400 when we receive expired JWT access_token", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter.mockJwt.payload.exp = absoluteTimeNow() - 500;
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		// @ts-ignore
		expect(out.body).toBe("Failed to Validate - Authentication header: Verification of exp failed");
		expect(out.statusCode).toBe(HttpCodesEnum.BAD_REQUEST);
	});

	it("Return 400 when session (based upon sub) was not found in the DB", async () => {
		mockCicService.getSessionById.mockResolvedValue(undefined);
		// @ts-ignore
		//const sub = userInforequestProcessorTest.validationHelper.eventToSubjectIdentifier.mockResolvedValue("sefsdgs");

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toContain("No session found with the sessionId: ");
		expect(out.statusCode).toBe(HttpCodesEnum.NOT_FOUND);
	});

	it.each([
		"full_name",
		"date_of_birth",
		"document_selected",
		"date_of_expiry",
	])("when %s userInfo data is missing - will return error", async (userInfoData ) => {
		// @ts-ignore
		mockSession[userInfoData] = "";
		mockCicService.getSessionById.mockResolvedValue(mockSession);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);

		expect(out.body).toBe("Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);

	});

});
