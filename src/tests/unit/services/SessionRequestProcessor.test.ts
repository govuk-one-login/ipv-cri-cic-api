/* eslint-disable max-lines-per-function */
/* eslint @typescript-eslint/unbound-method: 0 */
/* eslint jest/unbound-method: error */
import { SessionRequestProcessor } from "../../../services/SessionRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { CicService } from "../../../services/CicService";
import { VALID_SESSION, SESSION_WITH_INVALID_CLIENT } from "../data/session-events";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { KmsJwtAdapter } from "../../../utils/KmsJwtAdapter";
import { JWTPayload } from "jose";
import { Jwt } from "../../../utils/IVeriCredential";
import { ValidationHelper } from "../../../utils/ValidationHelper";
import { ISessionItem } from "../../../models/ISessionItem";
import { Constants } from "../../../utils/Constants";

let sessionRequestProcessor: SessionRequestProcessor;
const mockCicService = mock<CicService>();
const mockKmsJwtAdapter = mock<KmsJwtAdapter>();
const logger = mock<Logger>();
const metrics = mock<Metrics>();
const mockValidationHelper = mock<ValidationHelper>();

jest.mock("crypto", () => ({
	...jest.requireActual("crypto"),
	randomUUID: () => "sessionId",
}));

const decodedJwtFactory = ():Jwt => {
	return {
		header: {
			alg: "mock",
		},
		payload: {
			govuk_signin_journey_id: "abcdef",
		},
		signature: "signature",
	};
};

const decryptedJwtPayloadFactory = ():JWTPayload => {
	return {
		iss: "mock",
		sub: "mock",
		aud: "mock",
		jti: "mock",
		nbf: 1234,
		exp: 5678,
		iat: 1234,
	};
};

const sessionItemFactory = ():ISessionItem => {
	return {
		attemptCount: 0,
		authSessionState: "",
		clientId: "",
		clientIpAddress: "",
		clientSessionId: "",
		createdDate: 0,
		expiryDate: 0,
		persistentSessionId: "",
		redirectUri: "",
		sessionId: "",
		state: "",
		subject: "",
	};
};

describe("SessionRequestProcessor", () => {
	beforeAll(() => {
		sessionRequestProcessor = new SessionRequestProcessor(logger, metrics);
		// @ts-ignore
		sessionRequestProcessor.cicService = mockCicService;
		// @ts-ignore
		sessionRequestProcessor.kmsDecryptor = mockKmsJwtAdapter;
		// @ts-ignore
		sessionRequestProcessor.validationHelper = mockValidationHelper;
	});

	it("should report unrecognised client", async () => {
		const response = await sessionRequestProcessor.processRequest(SESSION_WITH_INVALID_CLIENT);

		expect(response.statusCode).toBe(HttpCodesEnum.BAD_REQUEST);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "UNRECOGNISED_CLIENT",
			}),
		);
	});

	it("should report a JWE decryption failure", async () => {
		mockKmsJwtAdapter.decrypt.mockRejectedValue("error");

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(response.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_DECRYPTING_JWE",
			}),
		);
	});

	it("should report a failure to decode JWT", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockImplementation(() => {
			throw Error("Error");
		});

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(response.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_DECODING_JWT",
			}),
		);
	});

	it("should report a JWT verification failure", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(null);

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(response.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_VERIFYING_JWT",
			}),
		);
	});

	it("should report an unexpected error verifying JWT", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockRejectedValue({});

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(response.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "UNEXPECTED_ERROR_VERIFYING_JWT",
			}),
		);
	});

	it("should report a JWT validation failure", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("errors");

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(response.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_VALIDATING_JWT",
			}),
		);
	});

	it("should report session already exists", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(sessionItemFactory());

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "SESSION_ALREADY_EXISTS",
			}),
		);
		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
			govuk_signin_journey_id: "abcdef",
		});
	});

	it("should handle session creation failure", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockRejectedValue("error");

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_CREATING_SESSION",
			}),
		);
		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
			govuk_signin_journey_id: "abcdef",
		});
	});

	it("should create a new session", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockResolvedValue();

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(response.statusCode).toBe(HttpCodesEnum.OK);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
			govuk_signin_journey_id: "abcdef",
		});
	});

	it("should create a new session but report a TxMA failure", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockResolvedValue();
		mockCicService.sendToTXMA.mockRejectedValue("failed");

		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(response.statusCode).toBe(HttpCodesEnum.OK);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_TO_WRITE_TXMA",
			}),
		);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: "sessionId",
			govuk_signin_journey_id: "abcdef",
		});
	});

	describe("should send correct TXMA event", () => {
		it("ip_address is X_FORWARDED_FOR if header is present", async () => {
			mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
			mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
			mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
			mockValidationHelper.isJwtValid.mockReturnValue("");
			mockCicService.getSessionById.mockResolvedValue(undefined);
			mockCicService.createAuthSession.mockResolvedValue();
			jest.useFakeTimers();
			const fakeTime = 1684933200;
			jest.setSystemTime(new Date(fakeTime * 1000)); // 2023-05-24T13:00:00.000Z

			await sessionRequestProcessor.processRequest(VALID_SESSION);

			expect(mockCicService.sendToTXMA).toHaveBeenCalledWith("MYQUEUE", {
				event_name: "CIC_CRI_START",
				component_id: "https://XXX-c.env.account.gov.uk",
				timestamp: 1684933200,
				event_timestamp_ms: 1684933200000,
				user: {
					govuk_signin_journey_id: "abcdef",
					ip_address: "1.1.1",
					persistent_session_id: undefined,
					session_id: "sessionId",
					transaction_id: "",
					user_id: "",
				},
			}, "ABCDEFG");
		});

		it("ip_address is source IP if no X_FORWARDED_FOR header is present", async () => {
			mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
			mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
			mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
			mockValidationHelper.isJwtValid.mockReturnValue("");
			mockCicService.getSessionById.mockResolvedValue(undefined);
			mockCicService.createAuthSession.mockResolvedValue();
			jest.useFakeTimers();
			const fakeTime = 1684933200;
			jest.setSystemTime(new Date(fakeTime * 1000)); // 2023-05-24T13:00:00.000Z

			const job = await sessionRequestProcessor.processRequest({ ...VALID_SESSION, headers: { "txma-audit-encoded": "ABCDEFG" } });
			console.log("job", job);
			expect(mockCicService.sendToTXMA).toHaveBeenCalledWith("MYQUEUE", {
				event_name: "CIC_CRI_START",
				component_id: "https://XXX-c.env.account.gov.uk",
				timestamp: 1684933200,
				event_timestamp_ms: 1684933200000,
				user: {
					govuk_signin_journey_id: "abcdef",
					ip_address: "2.2.2",
					persistent_session_id: undefined,
					session_id: "sessionId",
					transaction_id: "",
					user_id: "",
				},
			}, "ABCDEFG");
		});

		it("correctly sends context field when it is provided in JWT", async () => {
			mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
			mockKmsJwtAdapter.decode.mockReturnValue({ ...decodedJwtFactory(), payload: { ...decodedJwtFactory().payload, context: "bank_account" } });
			mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
			mockValidationHelper.isJwtValid.mockReturnValue("");
			mockCicService.getSessionById.mockResolvedValue(undefined);
			mockCicService.createAuthSession.mockResolvedValue();
			jest.useFakeTimers();
			const fakeTime = 1684933200;
			jest.setSystemTime(new Date(fakeTime * 1000)); // 2023-05-24T13:00:00.000Z

			await sessionRequestProcessor.processRequest(VALID_SESSION);

			expect(mockCicService.sendToTXMA).toHaveBeenCalledWith("MYQUEUE", {
				event_name: "CIC_CRI_START",
				component_id: "https://XXX-c.env.account.gov.uk",
				timestamp: 1684933200,
				event_timestamp_ms: 1684933200000,
				user: {
					govuk_signin_journey_id: "abcdef",
					ip_address: "1.1.1",
					persistent_session_id: undefined,
					session_id: "sessionId",
					transaction_id: "",
					user_id: "",
				},
				extensions: {
					evidence: {
						context: "bank_account",
					},
				},
			}, "ABCDEFG");
		});
	});

	it("the session created should have a valid expiryDate", async () => {
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockResolvedValue();
		jest.useFakeTimers();
		const fakeTime = 1684933200;
		jest.setSystemTime(new Date(fakeTime * 1000)); // 2023-05-24T13:00:00.000Z

		await sessionRequestProcessor.processRequest(VALID_SESSION);

		expect(mockCicService.createAuthSession).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				expiryDate: fakeTime + +process.env.AUTH_SESSION_TTL!,
			}),
		);
		// the next assertion checks that the value has no more than 10 digits, i.e. is in secs not ms
		// this will break in the year 2286!
		const actualExpiryDate = mockCicService.createAuthSession.mock.calls[0][0].expiryDate;
		expect(actualExpiryDate).toBeLessThan(10000000000);
		jest.useRealTimers();
	});
});
