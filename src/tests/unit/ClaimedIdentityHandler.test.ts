import { lambdaHandler } from "../../ClaimedIdentityHandler";

describe("ClaimedIdentityHandler", () => {
	it("return success response for claimedidentity", async () => {

		const response = await lambdaHandler("test", "test");

		expect(response).toBe("Hello World!");
	});
});
