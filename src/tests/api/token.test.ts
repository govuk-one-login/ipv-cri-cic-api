import { assert201Created, assert400BadRequest, assert401Unauthorized } from "../../utils/apiCommonAssertions";
import { authorizationGet, claimedIdentityPost, sessionPost, stubStartPost, tokenPost } from "../../utils/apiTestSteps";

describe("Happy Path Post Token", () => {
    
	let sessionId: string;
	let authResponse: any;

	beforeEach( async () =>{
		const requestBody = {
			target:"https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
		};
		const stubResponse = await stubStartPost(requestBody);

		const sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);

		sessionId = sessionResponse.data.session_id;

		await claimedIdentityPost( "Slim", "Pickens", "1970-03-26", "brp", "2024-03-31", sessionId);

		authResponse = await authorizationGet(sessionId);

	});
    
	it("Exchange an Authorization Code for an Access Token", async () => {
		const response = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
        
		assert201Created(response.status, response.statusText);

	});

});
