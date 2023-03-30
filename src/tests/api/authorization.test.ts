import { assert200OK, assert400BadRequest, assert401Unauthorized } from "../../utils/apiCommonAssertions";
import { authorizationGet, claimedIdentityPost, sessionPost, stubStartPost } from "../../utils/apiTestSteps";

describe("Happy Path Post Authorization", () => {
    
	let sessionId: string;

	beforeEach( async () =>{
		const requestBody = {
			target:"https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
		};
		const stubResponse = await stubStartPost(requestBody);

		const sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);

		sessionId = sessionResponse.data.session_id;

		await claimedIdentityPost( "Slim", "Pickens", "1970-03-26", "brp", "2024-03-31", sessionId);

	});
    
	it("Issue an authorization code for the session", async () => {

		console.log("SessionId abc: ", sessionId);
		const response = await authorizationGet(sessionId);
		console.log("response abc: ", response);
		assert200OK({ status: response.status, statusText: response.statusText });

	});

});
