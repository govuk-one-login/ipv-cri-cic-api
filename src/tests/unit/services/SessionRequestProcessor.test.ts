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

/* eslint @typescript-eslint/unbound-method: 0 */
/* eslint jest/unbound-method: error */

let sessionRequestProcessor: SessionRequestProcessor;
const mockCicService = mock<CicService>();
const mockKmsJwtAdapter = mock<KmsJwtAdapter>();
const logger = mock<Logger>();
const metrics = mock<Metrics>();
const mockValidationHelper = mock<ValidationHelper>();

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

		// Arrange

		// Act
		const response = await sessionRequestProcessor.processRequest(SESSION_WITH_INVALID_CLIENT);

		// Assert
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

		// Arrange
		mockKmsJwtAdapter.decrypt.mockRejectedValue("error");

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
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

		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockImplementation(() => {
			throw Error("Error");
		});

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
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

		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(null);

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
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

		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockRejectedValue({});

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
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

		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("errors");

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
		expect(response.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_VALIDATING_JWT",
			}),
		);
	});

	it("should report session already exists", async () => {
		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(sessionItemFactory());

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "SESSION_ALREADY_EXISTS",
			}),
		);
		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: expect.any(String),
			govuk_signin_journey_id: "abcdef",
		});
	});

	it("should fail to create a session", async () => {
		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockRejectedValue("error");

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_CREATING_SESSION",
			}),
		);
		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: expect.any(String),
			govuk_signin_journey_id: "abcdef",
		});
	});

	it("should create a new session", async () => {
		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockResolvedValue();

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
		expect(response.statusCode).toBe(HttpCodesEnum.OK);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: expect.any(String),
			govuk_signin_journey_id: "abcdef",
		});
	});

	it("should create a new session but report a TxMA failure", async () => {
		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockResolvedValue();
		mockCicService.sendToTXMA.mockRejectedValue("failed");

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
		expect(response.statusCode).toBe(HttpCodesEnum.OK);
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				messageCode: "FAILED_TO_WRITE_TXMA",
			}),
		);
		expect(logger.appendKeys).toHaveBeenCalledWith({
			sessionId: expect.any(String),
			govuk_signin_journey_id: "abcdef",
		});
	});

	it("the session created should have a valid expiryDate", async () => {
		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockResolvedValue();
		mockCicService.savePersonIdentity.mockRejectedValue("error");
		jest.useFakeTimers();
		const fakeTime = 1684933200;
		jest.setSystemTime(new Date(fakeTime * 1000)); // 2023-05-24T13:00:00.000Z

		// Act
		await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
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
