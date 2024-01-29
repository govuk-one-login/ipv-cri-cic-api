/* eslint-disable @typescript-eslint/unbound-method */
import { lambdaHandler, logger, metrics } from "../../SessionConfigHandler";
import { mock } from "jest-mock-extended";
import { Response } from "../../utils/Response";
import { HttpCodesEnum } from "../../utils/HttpCodesEnum";
import { MessageCodes } from "../../models/enums/MessageCodes";
import { SessionConfigRequestProcessor } from "../../services/SessionConfigRequestProcessor";
import { INVALID_SESSION_ID, MISSING_SESSION_ID, VALID_SESSIONCONFIG } from "./data/session-config-events";

jest.mock("@aws-lambda-powertools/logger", () => ({
	Logger: jest.fn().mockImplementation(() => ({
		setPersistentLogAttributes: jest.fn(),
		addContext: jest.fn(),
		appendKeys: jest.fn(),
		info: jest.fn(),
		error: jest.fn(),
	})),
}));

const mockedSessionConfigRequestProcessor = mock<SessionConfigRequestProcessor>();

jest.mock("../../services/SessionConfigRequestProcessor", () => {
	return {
		SessionConfigRequestProcessor: jest.fn(() => mockedSessionConfigRequestProcessor),
	};
});

describe("SessionConfigHandler", () => {
	it("return success response for SessionConfig", async () => {
		SessionConfigRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionConfigRequestProcessor);

		await lambdaHandler(VALID_SESSIONCONFIG, "SESSION_CONFIG");

		expect(mockedSessionConfigRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
		expect(logger.appendKeys).toHaveBeenCalledWith({ sessionId: VALID_SESSIONCONFIG.headers["x-govuk-signin-session-id"] });
	});

	it("returns bad request when sessionId is missing", async () => {
		SessionConfigRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionConfigRequestProcessor);

		await expect(lambdaHandler(MISSING_SESSION_ID, "SESSION_CONFIG")).resolves.toEqual(new Response(HttpCodesEnum.BAD_REQUEST, "Missing header: x-govuk-signin-session-id is required"));
		expect(logger.error).toHaveBeenCalledWith("Missing header: x-govuk-signin-session-id is required", expect.objectContaining({
			messageCode: MessageCodes.MISSING_HEADER,
		}));
	});

	it("returns bad request when sessionId is not valid", async () => {
		SessionConfigRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionConfigRequestProcessor);

		await expect(lambdaHandler(INVALID_SESSION_ID, "SESSION_CONFIG")).resolves.toEqual(new Response(HttpCodesEnum.BAD_REQUEST, "Session id must be a valid uuid"));
		expect(logger.error).toHaveBeenCalledWith("Session id not not a valid uuid", expect.objectContaining({
			messageCode: MessageCodes.FAILED_VALIDATING_SESSION_ID,
		}));
	});

	it("returns server error where SessionConfigRequestProcessor fails", async () => {
		SessionConfigRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionConfigRequestProcessor);
		const instance  = SessionConfigRequestProcessor.getInstance(logger, metrics);
		instance.processRequest = jest.fn().mockRejectedValueOnce({});

		await expect(lambdaHandler(VALID_SESSIONCONFIG, "SESSION_CONFIG")).resolves.toEqual(new Response(HttpCodesEnum.SERVER_ERROR, "Server Error"));
		expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
			message: "Error fetching journey type",
			error: {},
			messageCode: MessageCodes.SERVER_ERROR,
		}));
	});
});
