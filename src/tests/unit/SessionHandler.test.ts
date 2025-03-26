/* eslint-disable @typescript-eslint/unbound-method */
import { lambdaHandler, logger, metrics } from "../../SessionHandler";
import { mock } from "jest-mock-extended";
import { SessionRequestProcessor } from "../../services/SessionRequestProcessor";
import { VALID_SESSION } from "./data/session-events";
import { CONTEXT } from "./data/context";
import { HttpCodesEnum } from "../../utils/HttpCodesEnum";
import { Response } from "../../utils/Response";
import { MessageCodes } from "../../models/enums/MessageCodes";

const mockedSessionRequestProcessor = mock<SessionRequestProcessor>();
jest.mock("@aws-lambda-powertools/logger", () => ({
	Logger: jest.fn().mockImplementation(() => ({
		setPersistentLogAttributes: jest.fn(),
		addContext: jest.fn(),
		info: jest.fn(),
		error: jest.fn(),
	})),
}));
jest.mock("../../services/SessionRequestProcessor", () => {
	return {
		SessionRequestProcessor: jest.fn(() => mockedSessionRequestProcessor),
	};
});

describe("SessionHandler", () => {
	it("return success response for session", async () => {
		SessionRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionRequestProcessor);

		await lambdaHandler(VALID_SESSION, CONTEXT);

		expect(logger.info).toHaveBeenCalledWith("Received session request", { requestId: VALID_SESSION.requestContext.requestId });
		expect(mockedSessionRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
	});

	it("returns server error where SessionRequestProcessor fails", async () => {
		SessionRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedSessionRequestProcessor);
		const instance  = SessionRequestProcessor.getInstance(logger, metrics);
		instance.processRequest = jest.fn().mockRejectedValueOnce({});

		await expect(lambdaHandler(VALID_SESSION, CONTEXT)).resolves.toEqual(new Response(HttpCodesEnum.SERVER_ERROR, "Server Error"));
		expect(logger.error).toHaveBeenCalledWith("An error has occurred.", {
			error: {},
			messageCode: MessageCodes.SERVER_ERROR,
		});
	});
});
