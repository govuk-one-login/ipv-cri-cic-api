/* eslint-disable @typescript-eslint/unbound-method */
import { lambdaHandler, logger, metrics } from "../../AuthorizationCodeHandler";
import { mock } from "jest-mock-extended";
import { RESOURCE_NOT_FOUND, UNSUPPORTED_AUTHCODE, VALID_AUTHCODE, INVALID_SESSION_ID, MISSING_SESSION_ID } from "./data/auth-events";
import { Response } from "../../utils/Response";
import { HttpCodesEnum } from "../../utils/HttpCodesEnum";
import { MessageCodes } from "../../models/enums/MessageCodes";
import { AuthorizationRequestProcessor } from "../../services/AuthorizationRequestProcessor";

jest.mock("@aws-lambda-powertools/logger", () => ({
	Logger: jest.fn().mockImplementation(() => ({
		setPersistentLogAttributes: jest.fn(),
		addContext: jest.fn(),
		appendKeys: jest.fn(),
		info: jest.fn(),
		error: jest.fn(),
	})),
}));

const mockedAuthorizationRequestProcessor = mock<AuthorizationRequestProcessor>();

jest.mock("../../services/AuthorizationRequestProcessor", () => {
	return {
		AuthorizationRequestProcessor: jest.fn(() => mockedAuthorizationRequestProcessor),
	};
});

describe("AuthorizationCodeHandler", () => {
	it("return success response for AuthorizationCode", async () => {
		AuthorizationRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAuthorizationRequestProcessor);

		await lambdaHandler(VALID_AUTHCODE, "AUTH_CODE");

		expect(mockedAuthorizationRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
		expect(logger.appendKeys).toHaveBeenCalledWith({ sessionId: VALID_AUTHCODE.headers["session-id"] });
	});

	it("returns bad request when sessionId is missing", async () => {
		AuthorizationRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAuthorizationRequestProcessor);

		await expect(lambdaHandler(MISSING_SESSION_ID, "AUTH_CODE")).resolves.toEqual(new Response(HttpCodesEnum.BAD_REQUEST, "Missing header: session-id is required"));
		expect(logger.error).toHaveBeenCalledWith("Missing header: session-id is required", expect.objectContaining({
			messageCode: MessageCodes.MISSING_HEADER,
		}));
	});

	it("returns bad request when sessionId is not valid", async () => {
		AuthorizationRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAuthorizationRequestProcessor);

		await expect(lambdaHandler(INVALID_SESSION_ID, "AUTH_CODE")).resolves.toEqual(new Response(HttpCodesEnum.BAD_REQUEST, "Session id must be a valid uuid"));
		expect(logger.error).toHaveBeenCalledWith("Session id not not a valid uuid", expect.objectContaining({
			messageCode: MessageCodes.FAILED_VALIDATING_SESSION_ID,
		}));
	});

	it("returns server error where AuthorizationRequestProcessor fails", async () => {
		AuthorizationRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedAuthorizationRequestProcessor);
		const instance  = AuthorizationRequestProcessor.getInstance(logger, metrics);
		instance.processRequest = jest.fn().mockRejectedValueOnce({});

		await expect(lambdaHandler(VALID_AUTHCODE, "AUTH_CODE")).resolves.toEqual(new Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred"));
		expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
			message: "An error has occurred.",
			error: {},
			messageCode: MessageCodes.SERVER_ERROR,
		}));
	});
});
