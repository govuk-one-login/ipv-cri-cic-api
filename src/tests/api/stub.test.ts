import { assert201Created } from "../../utils/apiCommonAssertions";
import { stubStartPost } from "../../utils/apiTestSteps";

describe("IPV Core Stub Start point", () => {
	it("Given valid endpoint has been received", async () => {
		const requestBody = {
			target:"https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
		};
		const postResponse = await stubStartPost(requestBody);


		assert201Created(postResponse.status, postResponse.statusText);
	});

});

