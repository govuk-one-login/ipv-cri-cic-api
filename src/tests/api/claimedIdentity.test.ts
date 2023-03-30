import { assert200OK, assert400BadRequest, assert401Unauthorized } from "../../utils/apiCommonAssertions";
import { claimedIdentityPost, sessionPost, stubStartPost } from "../../utils/apiTestSteps";

describe("Happy Path Post Claimed Identity", () => {
    
	let sessionResponse: any;

	beforeEach( async () =>{
		const requestBody = {
			target:"https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
		};
		const stubResponse = await stubStartPost(requestBody);

		sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);

	});
    
	it("Given claimed identity has been posted", async () => {

		const sessionId = sessionResponse.data.session_id;
  
		const response = await claimedIdentityPost(
			"Slim", "Pickens", "1970-03-26", "brp", "2024-03-31", sessionId,
		);
 
		assert200OK({ status: response.status, statusText: response.statusText });

	});

});


// describe("UnHappy Path", () => {

//     it("401 response - Empty Request in request body",async () => {

//         const requestBody = {
//             target:"https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/"
//         }
//         const stubResponse = await stubStartPost(requestBody);

//         const response = await sessionPost(stubResponse.data.clientId,"")

//         assert401Unauthorized(response.status, response.statusText);

//         expect(response.data.message).toBe("Invalid request: Request failed to be decrypted");
//     })


//     it("400 response - Empty Client Id in request body",async () => {

//         const requestBody = {
//             target:"https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/"
//         }
//         const stubResponse = await stubStartPost(requestBody);

//         const response = await sessionPost("", stubResponse.data.request)

//         assert400BadRequest(response.status, response.statusText);

//         expect(response.data).toBe("Missing client config");
//     })


//     it("400 response - No Request Body",async () => {

//         const response = await sessionPost();

//         assert400BadRequest(response.status, response.statusText);

//         expect(response.data.message).toBe("Invalid request body");
//     })


// })
