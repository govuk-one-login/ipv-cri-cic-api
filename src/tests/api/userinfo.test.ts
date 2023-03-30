import { assert200OK, assert201Created, assert400BadRequest, assert401Unauthorized } from "../../utils/apiCommonAssertions";
import { authorizationGet, claimedIdentityPost, sessionPost, stubStartPost, tokenPost, userInfoPost } from "../../utils/apiTestSteps";

describe("Happy Path Post UserInfo", () => {
    
	let sessionId: string;
	let authResponse: any;
	let tokenResponse: any;

	beforeEach( async () =>{
		const requestBody = {
			target:"https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
		};
		const stubResponse = await stubStartPost(requestBody);

		const sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);

		sessionId = sessionResponse.data.session_id;

		await claimedIdentityPost( "Slim", "Pickens", "1970-03-26", "brp", "2024-03-31", sessionId);

		authResponse = await authorizationGet(sessionId);

		tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri);

	});
    
	it("Generate jwt", async () => {
		const response = await userInfoPost(tokenResponse.data.access_token);
		console.log("Response XYZ", response);
        
		assert200OK({ status: response.status, statusText: response.statusText });

	});

});
