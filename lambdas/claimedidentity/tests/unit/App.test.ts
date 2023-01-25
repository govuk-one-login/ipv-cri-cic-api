import { lambdaHandler } from "../../src/App";
import { mock } from "jest-mock-extended";
import { event } from "./data/events";
import { RequestProcessor } from "../../src/services/RequestProcessor";

const mockedRequestProcessor = mock<RequestProcessor>();

jest.mock("../../src/services/RequestProcessor", () => {
	return {
		RequestProcessor: jest.fn(() => mockedRequestProcessor),
	};
});

describe("Unit test for app handler", () => {
	it("verifies empty payload response", async () => {
		RequestProcessor.getInstance = jest.fn().mockReturnValue(mockedRequestProcessor);

		await lambdaHandler(event);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
	});
});
