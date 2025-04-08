import { lambdaHandler } from "../../ClaimedIdentityHandler";
import { mock } from "jest-mock-extended";
import { VALID_CLAIMEDID } from "./data/cic-events";
import { ClaimedIdRequestProcessor } from "../../services/ClaimedIdRequestProcessor";

const mockedClaimedIdRequestProcessor = mock<ClaimedIdRequestProcessor>();

jest.mock("../../services/ClaimedIdRequestProcessor", () => {
	return {
		ClaimedIdRequestProcessor: jest.fn(() => mockedClaimedIdRequestProcessor),
	};
});

describe("ClaimedIdentityHandler", () => {
	it("return success response for claimedidentity", async () => {
		ClaimedIdRequestProcessor.getInstance = jest.fn().mockReturnValue(mockedClaimedIdRequestProcessor);

		await lambdaHandler(VALID_CLAIMEDID, "CIC");

		 
		expect(mockedClaimedIdRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
	});
});
