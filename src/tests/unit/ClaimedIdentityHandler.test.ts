import { lambdaHandler } from "../../ClaimedIdentityHandler";
import { mock } from "vitest-mock-extended";
import { VALID_CLAIMEDID } from "./data/cic-events";
import { ClaimedIdRequestProcessor } from "../../services/ClaimedIdRequestProcessor";

const mockedClaimedIdRequestProcessor = mock<ClaimedIdRequestProcessor>();

vi.mock("../../services/ClaimedIdRequestProcessor", () => {
	return {
		ClaimedIdRequestProcessor: vi.fn(() => mockedClaimedIdRequestProcessor),
	};
});

describe("ClaimedIdentityHandler", () => {
	it("return success response for claimedidentity", async () => {
		ClaimedIdRequestProcessor.getInstance = vi.fn().mockReturnValue(mockedClaimedIdRequestProcessor);

		await lambdaHandler(VALID_CLAIMEDID, "CIC");

		 
		expect(mockedClaimedIdRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
	});
});
