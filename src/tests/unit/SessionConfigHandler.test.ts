 
import { mockLogger, mockPowertoolsLogger} from "./helpers/mockPowertoolsLogger";
import { lambdaHandler, metrics } from "../../SessionConfigHandler";
import { mock } from "vitest-mock-extended";
import { Response } from "../../utils/Response";
import { HttpCodesEnum } from "../../utils/HttpCodesEnum";
import { MessageCodes } from "../../models/enums/MessageCodes";
import { SessionConfigRequestProcessor } from "../../services/SessionConfigRequestProcessor";
import { INVALID_SESSION_ID, MISSING_SESSION_ID, VALID_SESSIONCONFIG } from "./data/session-config-events";

mockPowertoolsLogger();

vi.mock("../../services/SessionConfigRequestProcessor", () => {
	return {
		SessionConfigRequestProcessor: vi.fn(() => mockedSessionConfigRequestProcessor),
	};
});

const mockedSessionConfigRequestProcessor = mock<SessionConfigRequestProcessor>();

describe("SessionConfigHandler", () => {
	it("return success response for SessionConfig", async () => {
		SessionConfigRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedSessionConfigRequestProcessor);

		await lambdaHandler(VALID_SESSIONCONFIG, "SESSION_CONFIG");

		expect(mockedSessionConfigRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
		expect(mockLogger.appendKeys).toHaveBeenCalledWith({ sessionId: VALID_SESSIONCONFIG.headers["x-govuk-signin-session-id"] });
	});

	it("returns bad request when sessionId is missing", async () => {
		SessionConfigRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedSessionConfigRequestProcessor);

		await expect(lambdaHandler(MISSING_SESSION_ID, "SESSION_CONFIG")).resolves.toEqual(Response(HttpCodesEnum.BAD_REQUEST, "Missing header: x-govuk-signin-session-id is required"));
		expect(mockLogger.error).toHaveBeenCalledWith("Missing header: x-govuk-signin-session-id is required", expect.objectContaining({
			messageCode: MessageCodes.MISSING_HEADER,
		}));
	});

	it("returns bad request when sessionId is not valid", async () => {
		SessionConfigRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedSessionConfigRequestProcessor);

		await expect(lambdaHandler(INVALID_SESSION_ID, "SESSION_CONFIG")).resolves.toEqual(Response(HttpCodesEnum.BAD_REQUEST, "Session id must be a valid uuid"));
		expect(mockLogger.error).toHaveBeenCalledWith("Session id not not a valid uuid", expect.objectContaining({
			messageCode: MessageCodes.FAILED_VALIDATING_SESSION_ID,
		}));
	});

	it("returns server error where SessionConfigRequestProcessor fails", async () => {
		SessionConfigRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedSessionConfigRequestProcessor);
		const instance  = SessionConfigRequestProcessor.getInstance(metrics);
		instance.processRequest = vi.fn().mockRejectedValueOnce({});

		await expect(lambdaHandler(VALID_SESSIONCONFIG, "SESSION_CONFIG")).resolves.toEqual(Response(HttpCodesEnum.SERVER_ERROR, "Server Error"));
		expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({
			message: "Error fetching journey type",
			error: {},
			messageCode: MessageCodes.SERVER_ERROR,
		}));
	});
});
