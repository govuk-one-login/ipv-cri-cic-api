import { stubStartPost, sessionPost, startStubServiceAndReturnSessionId, claimedIdentityPost } from "../utils/ApiTestSteps";
import * as dataSlim from "../data/happyPathSlim.json";


describe("E2E Negative Path Tests - Sessions Endpoint", () => {
	let stubResponse: any;
	beforeAll(async () => {
		stubResponse = await stubStartPost();
	});

	it("E2E Negative Path Journey - Sessions: Empty Request Body", async () => {
		// Session Post      
		const sessionRequest = await sessionPost(stubResponse.data.clientId, "");
		expect(sessionRequest.status).toBe(401);
		expect(sessionRequest.data.message).toBe("Invalid request: Request failed to be decrypted");
	});

	it("E2E Negative Path Journey - Sessions: Empty Client ID", async () => {
		// Session Post
		const sessionRequest = await sessionPost("", stubResponse.data.request);
		expect(sessionRequest.status).toBe(400);
		expect(sessionRequest.data).toBe("Missing client config");
	});

	it("E2E Negative Path Journey - Sessions: Incorrect Client ID", async () => {
		// Session Post
		const sessionRequest = await sessionPost("1A2B3C4D", stubResponse.data.request);
		expect(sessionRequest.status).toBe(400);
		expect(sessionRequest.data).toBe("Missing client config");
	});

});

describe("E2E Negative Path Tests - Claimed Identity Endpoint", () => {
	let sessionId: any;
	beforeAll(async () => {
		const sessionResponse = await startStubServiceAndReturnSessionId();
		expect(sessionResponse.status).toBe(200);
		sessionId = sessionResponse.data.session_id;
	});

	it("E2E Negative Path Journey - Claimed Identity: No Name in Payload", async () => {
		// Session Post      
		console.log(sessionId);
		const calimedIdentityResponse = await claimedIdentityPost(null, null, dataSlim.dateOfBirth, sessionId);
		expect(calimedIdentityResponse.status).toBe(400);
	});

	it("E2E Negative Path Journey - Claimed Identity: No DoB in Payload", async () => {
		// Session Post
		const calimedIdentityResponse = await claimedIdentityPost(dataSlim.firstName, dataSlim.lastName, null, sessionId);
		expect(calimedIdentityResponse.status).toBe(400);
	});

});
