import { UserInfoRequestProcessor } from "../../../services/UserInfoRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import {MISSING_AUTH_HEADER_USERINFO, VALID_USERINFO} from "../data/userInfo-events";
import { CicService } from "../../../services/CicService";
import { VerifiableCredentialService} from "../../../vendor/VerifiableCredentialService";
import { SessionItem } from "../../../models/SessionItem";
import { Response } from "../../../utils/Response";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";

let userInforequestProcessorTest: UserInfoRequestProcessor;
const mockCicService = mock<CicService>();
const mockVerifiableCredService = mock<VerifiableCredentialService>();

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CIC",
});
const metrics = new Metrics({ namespace: "CIC" });

function getMockSessionItem() {
	const sess: SessionItem = new SessionItem();
	sess.clientId = "ipv-core";
	sess.fullName = "test user";
	sess.dateOfBirth = "09-08-1961";
	sess.documentSelected = "Passport";
	sess.dateOfExpiry = "23-04-1027";
	return sess;
}

const mockSession : SessionItem = getMockSessionItem();

describe("UserInfoRequestProcessor", () => {
	beforeAll(() => {
		userInforequestProcessorTest = new UserInfoRequestProcessor(logger, metrics);
		// @ts-ignore
		userInforequestProcessorTest.cicService = mockCicService;
		// @ts-ignore
		userInforequestProcessorTest.verifiableCredentialService = mockVerifiableCredService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("Return successful response with 200 OK when user data is found for an accessToken", async () => {
		const mockSignedJWT = "sewgwey346hdfhdh236"
		mockCicService.getSessionByAccessToken.mockResolvedValue(mockSession);
		mockVerifiableCredService.generateSignedVerifiableCredentialJwt.mockResolvedValue(mockSignedJWT);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionByAccessToken).toHaveBeenCalledTimes(1);

		expect(out.body).toEqual(JSON.stringify({
			sub: "ipv-core",
			"https://vocab.account.gov.uk/v1/credentialJWT": [mockSignedJWT]
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});

	it("Return 400 when Authorization header is missing in the request", async () => {
		const out: Response = await userInforequestProcessorTest.processRequest(MISSING_AUTH_HEADER_USERINFO);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		// @ts-ignore
		expect(out.body).toBe("Missing header: Authorization header value is missing or invalid auth_scheme");
		expect(out.statusCode).toBe(HttpCodesEnum.BAD_REQUEST);
	});

	it("Return 400 when session with that accessToken was not found in the DB", async () => {
		mockCicService.getSessionByAccessToken.mockResolvedValue(undefined);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionByAccessToken).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("No session found with the accesstoken: AbCdEf123456");
		expect(out.statusCode).toBe(HttpCodesEnum.NOT_FOUND);
	});

	it("Return 500 server error when fullName is missing from the session table", async () => {
		// Empty the fullName value in the mock sessionItem
		mockSession.fullName = "";
		mockCicService.getSessionByAccessToken.mockResolvedValue(mockSession);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionByAccessToken).toHaveBeenCalledTimes(1);

		expect(out.body).toBe("Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
	});

	it("Return 500 server error when dateOfBirth is missing from the session table", async () => {
		// Empty the dateOfBirth value in the mock sessionItem
		mockSession.dateOfBirth = "";
		mockCicService.getSessionByAccessToken.mockResolvedValue(mockSession);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionByAccessToken).toHaveBeenCalledTimes(1);

		expect(out.body).toBe("Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
	});

	it("Return 500 server error when documentSelected is missing from the session table", async () => {
		// Empty the documentSelected value in the mock sessionItem
		mockSession.documentSelected = "";
		mockCicService.getSessionByAccessToken.mockResolvedValue(mockSession);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionByAccessToken).toHaveBeenCalledTimes(1);

		expect(out.body).toBe("Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
	});

	it("Return 500 server error when dateOfExpiry is missing from the session table", async () => {
		// Empty the dateOfExpiry value in the mock sessionItem
		mockSession.dateOfExpiry = "";
		mockCicService.getSessionByAccessToken.mockResolvedValue(mockSession);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionByAccessToken).toHaveBeenCalledTimes(1);

		expect(out.body).toBe("Missing user info: User may have not completed the journey, hence few of the required user data is missing.");
		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
	});
});
