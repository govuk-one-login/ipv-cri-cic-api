import { lambdaHandler } from "../../App";
import { mock } from "jest-mock-extended";
import { VALID_CLAIMEDID, UNSUPPORTED_CLAIMEDID, RESOURCE_NOT_FOUND } from "./data/events";
import { RequestProcessor } from "../../services/RequestProcessor";
import { Response } from "../../utils/Response";
import { StatusCodes } from "http-status-codes";

const mockedRequestProcessor = mock<RequestProcessor>();

jest.mock("../../services/RequestProcessor", () => {
	return {
		RequestProcessor: jest.fn(() => mockedRequestProcessor),
	};
});

describe("App", () => {
	it("return success response for claimedidentity", async () => {
		RequestProcessor.getInstance = jest.fn().mockReturnValue(mockedRequestProcessor);

		await lambdaHandler(VALID_CLAIMEDID);

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
	});

	it("return not found when unsupported http method tried for claimedidentity", async () => {
		RequestProcessor.getInstance = jest.fn().mockReturnValue(mockedRequestProcessor);

	     return expect(lambdaHandler(UNSUPPORTED_CLAIMEDID)).resolves.toEqual(new Response(StatusCodes.NOT_FOUND, ""));
	});

	it("return not found when resource not found", async () => {
		RequestProcessor.getInstance = jest.fn().mockReturnValue(mockedRequestProcessor);

		return expect(lambdaHandler(RESOURCE_NOT_FOUND)).rejects.toThrow(expect.objectContaining({
			statusCode: StatusCodes.NOT_FOUND,
		}));
	});
});
