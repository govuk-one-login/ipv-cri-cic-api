import { SessionRequestProcessor } from "../../../services/SessionRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { CicService } from "../../../services/CicService";
import { VALID_SESSION } from "../data/session-events";
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
		payload: {},
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

	it("should report a JWE decryption failure", async () => {

		// Arrange
		mockKmsJwtAdapter.decrypt.mockRejectedValue("error");

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
		expect(response.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);

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
			"FAILED_DECODING_JWT",
			expect.anything(),
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
		expect(response.body).toBe("{\"redirect\":null,\"message\":\"JWT verification failed\"}");
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
		expect(logger.debug).toHaveBeenCalledTimes(1);
		expect(logger.debug).toHaveBeenCalledWith(
			"UNEXPECTED_ERROR_VERIFYING_JWT",
			expect.anything(),
		);
		expect(response.body).toBe("{\"redirect\":null,\"message\":\"Invalid request: Could not verify jwt\"}");
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
		expect(response.body).toBe("{\"redirect\":null,\"message\":\"JWT validation/verification failed\"}");
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
			"SESSION_ALREADY_EXISTS",
			expect.anything(),
		);
		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
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
			"FAILED_CREATING_SESSION",
			expect.anything(),
		);
		expect(response.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
	});

	it("should create a new session", async () => {
		// Arrange
		mockKmsJwtAdapter.decrypt.mockResolvedValue("success");
		mockKmsJwtAdapter.decode.mockReturnValue(decodedJwtFactory());
		mockKmsJwtAdapter.verifyWithJwks.mockResolvedValue(decryptedJwtPayloadFactory());
		mockValidationHelper.isJwtValid.mockReturnValue("");
		mockCicService.getSessionById.mockResolvedValue(undefined);
		mockCicService.createAuthSession.mockResolvedValue();
		mockCicService.savePersonIdentity.mockRejectedValue("error");

		// Act
		const response = await sessionRequestProcessor.processRequest(VALID_SESSION);

		// Assert
		expect(response.statusCode).toBe(HttpCodesEnum.OK);
	});
});
