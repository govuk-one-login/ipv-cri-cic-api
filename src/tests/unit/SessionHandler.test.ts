 
import { logger } from "@govuk-one-login/cri-logger";
import { lambdaHandler, metrics } from "../../SessionHandler";
import { mock } from "vitest-mock-extended";
import { SessionRequestProcessor } from "../../services/SessionRequestProcessor";
import { VALID_SESSION } from "./data/session-events";
import { CONTEXT } from "./data/context";
import { HttpCodesEnum } from "../../utils/HttpCodesEnum";
import { Response } from "../../utils/Response";
import { MessageCodes } from "../../models/enums/MessageCodes";

vi.mock("@govuk-one-login/cri-logger");

const mockedSessionRequestProcessor = mock<SessionRequestProcessor>();

vi.mock("../../services/SessionRequestProcessor", () => {
	return {
		SessionRequestProcessor: vi.fn(() => mockedSessionRequestProcessor),
	};
});

describe("SessionHandler", () => {
	it("return success response for session", async () => {
		SessionRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedSessionRequestProcessor);

		await lambdaHandler(VALID_SESSION, CONTEXT);

		expect(logger.info).toHaveBeenCalledWith("Received session request", { requestId: VALID_SESSION.requestContext.requestId });
		expect(mockedSessionRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
	});

	it("returns server error where SessionRequestProcessor fails", async () => {
		SessionRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedSessionRequestProcessor);
		const instance  = SessionRequestProcessor.getInstance(metrics);
		instance.processRequest = vi.fn().mockRejectedValueOnce({});

		await expect(lambdaHandler(VALID_SESSION, CONTEXT)).resolves.toEqual(Response(HttpCodesEnum.SERVER_ERROR, "Server Error"));
		expect(logger.error).toHaveBeenCalledWith("An error has occurred.", {
			error: {},
			messageCode: MessageCodes.SERVER_ERROR,
		});
	});
});
