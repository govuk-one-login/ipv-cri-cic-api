import { lambdaHandler } from "../../ClaimedIdentityHandler";
import { mock } from "jest-mock-extended";
import { VALID_CLAIMEDID, UNSUPPORTED_CLAIMEDID, RESOURCE_NOT_FOUND } from "./data/cic-events";
import { ClaimedIdRequestProcessor } from "../../services/ClaimedIdRequestProcessor";
import { Response } from "../../utils/Response";
import { HttpCodesEnum } from "../../utils/HttpCodesEnum";

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

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockedClaimedIdRequestProcessor.processRequest).toHaveBeenCalledTimes(1);
	});
});
