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
import { MockFailingKmsSigningJwtAdapter, MockKmsJwtAdapter } from "../utils/MockJwtVerifierSigner";

/* eslint @typescript-eslint/unbound-method: 0 */
/* eslint jest/unbound-method: error */

let userInforequestProcessorTest: UserInfoRequestProcessor;
const mockCicService = mock<CicService>();
let mockSession: ISessionItem;
const passingKmsJwtAdapterFactory = (_signingKeys: string) => new MockKmsJwtAdapter(true);
const failingKmsJwtAdapterFactory = (_signingKeys: string) => new MockKmsJwtAdapter(false);
const failingKmsJwtSigningAdapterFactory = (_signingKeys: string) => new MockFailingKmsSigningJwtAdapter();


const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "CIC" });

function getMockSessionItem(): ISessionItem {
	const sess: ISessionItem = {
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
		authSessionState: "CIC_ACCESS_TOKEN_ISSUED",
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
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(mockCicService.sendToTXMA).toHaveBeenCalledTimes(1);

		expect(out.body).toEqual(JSON.stringify({
			sub: "ipv-core-stub",
			"https://vocab.account.gov.uk/v1/credentialJWT": ["signedJwt-test"],
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(logger.info).toHaveBeenCalledTimes(2);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
	});

	it("Return 401 when Authorization header is missing in the request", async () => {
		const out: Response = await userInforequestProcessorTest.processRequest(MISSING_AUTH_HEADER_USERINFO);

		// @ts-ignore
		expect(out.body).toBe("Failed to Validate - Authentication header: Missing header: Authorization header value is missing or invalid auth_scheme");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
	});

	it("Return 401 when access_token JWT validation fails", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter = failingKmsJwtAdapterFactory();
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// @ts-ignore
		expect(out.body).toBe("Failed to Validate - Authentication header: Verification of JWT failed");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
	});

	it("Return 401 when sub is missing from JWT access_token", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter.mockJwt.payload.sub = null;
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// @ts-ignore
		expect(out.body).toBe("Failed to Validate - Authentication header: sub missing");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
	});

	it("Return 401 when we receive expired JWT access_token", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter.mockJwt.payload.exp = absoluteTimeNow() - 500;
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// @ts-ignore
		expect(out.body).toBe("Failed to Validate - Authentication header: Verification of exp failed");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
	});

	it("Return 401 when session (based upon sub) was not found in the DB", async () => {
		mockCicService.getSessionById.mockResolvedValue(undefined);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toContain("Unauthorized");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
	});

	it.each([
		"given_names",
		"family_names",
		"date_of_birth",
	])("when %s userInfo data is missing - will return error", async (userInfoData) => {
		// @ts-ignore
		mockSession[userInfoData] = "";
		mockCicService.getSessionById.mockResolvedValue(mockSession);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("Server Error");
		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
	});

	it("Return 401 when AuthSessionState is not CIC_ACCESS_TOKEN_ISSUED", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockSession.authSessionState = "CIC_AUTH_CODE_ISSUED";
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toContain("Unauthorized");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
	});

	it("Return 500 when Failed to sign the verifiableCredential Jwt", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		// @ts-ignore
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = failingKmsJwtSigningAdapterFactory();
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toContain("Server Error");
		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(logger.error).toHaveBeenCalledTimes(2);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
	});

	it("Return successful response with 200 OK when write to txMA fails", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockCicService.sendToTXMA.mockRejectedValue({});
		// @ts-ignore
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(mockCicService.sendToTXMA).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith("Failed to write TXMA event CIC_CRI_VC_ISSUED to SQS queue.", expect.anything());
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(out.body).toEqual(JSON.stringify({
			sub: "ipv-core-stub",
			"https://vocab.account.gov.uk/v1/credentialJWT": ["signedJwt-test"],
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});
});
