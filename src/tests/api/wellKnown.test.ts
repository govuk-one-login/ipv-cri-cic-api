import { assert200OK, assert201Created, assert400BadRequest, assert401Unauthorized } from "../../utils/apiCommonAssertions";
import { authorizationGet, claimedIdentityPost, sessionPost, stubStartPost, tokenPost, userInfoPost, wellKnownGet } from "../../utils/apiTestSteps";

describe("Happy Path Get WellKnown", () => {

	it("Check wellKnown", async () => {
		const response = await wellKnownGet();
         
        
		assert200OK({ status: response.status, statusText: response.statusText });

	});

});
