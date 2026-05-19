 
import { mockLogger, mockPowertoolsLogger} from "./helpers/mockPowertoolsLogger";
mockPowertoolsLogger();

import { lambdaHandler, metrics } from "../../AuthorizationCodeHandler";
import { mock } from "vitest-mock-extended";
import { VALID_AUTHCODE, INVALID_SESSION_ID, MISSING_SESSION_ID } from "./data/auth-events";
import { Response } from "../../utils/Response";
import { HttpCodesEnum } from "../../utils/HttpCodesEnum";
import { MessageCodes } from "../../models/enums/MessageCodes";
import { AuthorizationRequestProcessor } from "../../services/AuthorizationRequestProcessor";

vi.mock("../../services/AuthorizationRequestProcessor", () => {
	return {
		AuthorizationRequestProcessor: vi.fn(() => mockedAuthorizationRequestProcessor),
	};
});

const mockedAuthorizationRequestProcessor = mock<AuthorizationRequestProcessor>();

describe("AuthorizationCodeHandler", () => {
	it("return success response for AuthorizationCode", async () => {
		AuthorizationRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedAuthorizationRequestProcessor);

		await lambdaHandler(VALID_AUTHCODE, "AUTH_CODE");

		expect(mockedAuthorizationRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
		expect(mockLogger.appendKeys).toHaveBeenCalledWith({ sessionId: VALID_AUTHCODE.headers["session-id"] });
	});

	it("returns bad request when sessionId is missing", async () => {
		AuthorizationRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedAuthorizationRequestProcessor);

		await expect(lambdaHandler(MISSING_SESSION_ID, "AUTH_CODE")).resolves.toEqual(Response(HttpCodesEnum.BAD_REQUEST, "Missing header: session-id is required"));
		expect(mockLogger.error).toHaveBeenCalledWith("Missing header: session-id is required", expect.objectContaining({
			messageCode: MessageCodes.MISSING_HEADER,
		}));
	});

	it("returns bad request when sessionId is not valid", async () => {
		AuthorizationRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedAuthorizationRequestProcessor);

		await expect(lambdaHandler(INVALID_SESSION_ID, "AUTH_CODE")).resolves.toEqual(Response(HttpCodesEnum.BAD_REQUEST, "Session id must be a valid uuid"));
		expect(mockLogger.error).toHaveBeenCalledWith("Session id not not a valid uuid", expect.objectContaining({
			messageCode: MessageCodes.FAILED_VALIDATING_SESSION_ID,
		}));
	});

	it("returns server error where AuthorizationRequestProcessor fails", async () => {
		AuthorizationRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedAuthorizationRequestProcessor);
		const instance  = AuthorizationRequestProcessor.getInstance(metrics);
		instance.processRequest = vi.fn().mockRejectedValueOnce({});

		await expect(lambdaHandler(VALID_AUTHCODE, "AUTH_CODE")).resolves.toEqual(Response(HttpCodesEnum.SERVER_ERROR, "An error has occurred"));
		expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({
			message: "An error has occurred.",
			error: {},
			messageCode: MessageCodes.SERVER_ERROR,
		}));
	});
});
