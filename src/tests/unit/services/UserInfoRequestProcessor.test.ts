import { UserInfoRequestProcessor } from "../../../services/UserInfoRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { MISSING_AUTH_HEADER_USERINFO, VALID_USERINFO } from "../data/userInfo-events";
import { CicService } from "../../../services/CicService";
import { Response } from "../../../utils/Response";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { ISessionItem } from "../../../models/ISessionItem";
import { PersonIdentityItem } from "../../../models/PersonIdentityItem";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { MockFailingKmsSigningJwtAdapter, MockKmsJwtAdapter } from "../utils/MockJwtVerifierSigner";

/* eslint @typescript-eslint/unbound-method: 0 */
/* eslint jest/unbound-method: error */

let userInforequestProcessorTest: UserInfoRequestProcessor;
const mockCicService = mock<CicService>();
let mockSession: ISessionItem;
let mockPerson: PersonIdentityItem;
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
		authSessionState: "CIC_ACCESS_TOKEN_ISSUED",
	};
	return sess;
}

function getMockPersonItem(): PersonIdentityItem {
	const person: PersonIdentityItem = {
		sessionId: "sdfsdg",
		addresses: [{
			uprn: 100,
			organisationName: "string",
			departmentName: "string",
			subBuildingName: "string",
			buildingNumber: "string",
			buildingName: "string",
			dependentStreetName: "string",
			streetName: "string",
			doubleDependentAddressLocality: "string",
			dependentAddressLocality: "string",
			addressLocality: "string",
			postalCode: "string",
			addressCountry: "string",
			validFrom: "string",
			validUntil: "string",
		}],
		personNames: [{ nameParts: [{ type: "First", value: "Name" }] }],
		birthDates: [{ value: "1990-01-01" }],
		expiryDate: 123,

	};
	return person;
}

describe("UserInfoRequestProcessor", () => {
	beforeAll(() => {
		mockSession = getMockSessionItem();
		mockPerson = getMockPersonItem();
		userInforequestProcessorTest = new UserInfoRequestProcessor(logger, metrics);
		// @ts-ignore
		userInforequestProcessorTest.cicService = mockCicService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter = passingKmsJwtAdapterFactory();
		mockSession = getMockSessionItem();
		mockPerson = getMockPersonItem();
	});

	it("Return successful response with 200 OK when user data is found for an accessToken", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(mockPerson);
		// @ts-ignore
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(mockCicService.getPersonIdentityBySessionId).toHaveBeenCalledTimes(1);
		expect(mockCicService.sendToTXMA).toHaveBeenCalledTimes(2);
		expect(out.body).toEqual(JSON.stringify({
			sub: "sub",
			"https://vocab.account.gov.uk/v1/credentialJWT": ["signedJwt-test"],
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(logger.info).toHaveBeenCalledTimes(3);
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
		expect(out.body).toBe("Unauthorized");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			"Error validating Authentication Access token from headers: ",
			expect.objectContaining({
				messageCode: "INVALID_AUTH_CODE",
			}),
		);
	});

	it("Return 401 when access_token JWT validation fails", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter = failingKmsJwtAdapterFactory();
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// @ts-ignore
		expect(out.body).toBe("Unauthorized");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			"Error validating Authentication Access token from headers: ",
			expect.objectContaining({
				messageCode: "INVALID_AUTH_CODE",
			}),
		);
	});

	it("Return 401 when sub is missing from JWT access_token", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter.mockJwt.payload.sub = null;
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// @ts-ignore
		expect(out.body).toBe("Unauthorized");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			"Error validating Authentication Access token from headers: ",
			expect.objectContaining({
				messageCode: "INVALID_AUTH_CODE",
			}),
		);
	});

	it("Return 401 when we receive expired JWT access_token", async () => {
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter.mockJwt.payload.exp = absoluteTimeNow() - 500;
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		// @ts-ignore
		expect(out.body).toBe("Unauthorized");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			"Error validating Authentication Access token from headers: ",
			expect.objectContaining({
				messageCode: "INVALID_AUTH_CODE",
			}),
		);
	});

	it("Return 401 when session (based upon sub) was not found in the DB", async () => {
		mockCicService.getSessionById.mockResolvedValue(undefined);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toContain("Unauthorized");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "SESSION_NOT_FOUND",
			}),
		);
	});

	it("Return 401 when person (based upon sub) was not found in the DB", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(undefined);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		expect(mockCicService.getPersonIdentityBySessionId).toHaveBeenCalledTimes(1);
		expect(out.body).toContain("Unauthorized");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "PERSON_NOT_FOUND",
			}),
		);
	});

	it("Return error when person names are missing", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		// @ts-ignore
		mockPerson.personNames[0].nameParts = [];
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(mockPerson);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(mockCicService.getPersonIdentityBySessionId).toHaveBeenCalledTimes(1);

		expect(out.body).toBe("Bad Request");
		expect(out.statusCode).toBe(HttpCodesEnum.BAD_REQUEST);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "INVALID_CLAIMED_IDENTITY",
			}),
		);
	});

	it("Return error when person DoB is missing", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		// @ts-ignore
		mockPerson.birthDates[0].value = "";
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(mockPerson);

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(mockCicService.getPersonIdentityBySessionId).toHaveBeenCalledTimes(1);

		expect(out.body).toBe("Bad Request");
		expect(out.statusCode).toBe(HttpCodesEnum.BAD_REQUEST);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "INVALID_CLAIMED_IDENTITY",
			}),
		);
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
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "STATE_MISMATCH",
			}),
		);
	});

	it("Return 500 when Failed to sign the verifiableCredential Jwt", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(mockPerson);

		// @ts-ignore
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = failingKmsJwtSigningAdapterFactory();
		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(mockCicService.getPersonIdentityBySessionId).toHaveBeenCalledTimes(1);
		expect(out.body).toContain("Server Error");
		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(logger.error).toHaveBeenCalledTimes(2);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "ERROR_SIGNING_VC",
			}),
		);
	});

	it("Return server error response with 500 SERVER ERROR when write to txMA fails", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(mockPerson);

		mockCicService.sendToTXMA.mockRejectedValue({});
		// @ts-ignore
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(mockCicService.getPersonIdentityBySessionId).toHaveBeenCalledTimes(1);
		expect(mockCicService.sendToTXMA).toHaveBeenCalledTimes(2);
		expect(logger.error).toHaveBeenCalledWith("Failed to write TXMA event CIC_CRI_VC_ISSUED to SQS queue.", expect.anything());
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
		});
		expect(logger.error).toHaveBeenCalledTimes(2);
		expect(out.body).toEqual(JSON.stringify({
			sub: "sub",
			"https://vocab.account.gov.uk/v1/credentialJWT": ["signedJwt-test"],
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});
});
