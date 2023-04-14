import { stubStartPost, sessionPost, startStubServiceAndReturnSessionId, claimedIdentityPost } from "../utils/ApiTestSteps";
import { assertStatusCode, assertResponseMessage, assertResponseData } from "../utils/ApiHelper";
import * as dataSlim from "../data/happyPathSlim.json";


describe("E2E Negative Path Tests - Sessions Endpoint", () => {
	let stubResponse: any;
	beforeAll(async () => {
		stubResponse = await stubStartPost();
	});

	it("E2E Negative Path Journey - Sessions: Empty Request Body", async () => {
		// Session Post      
		const sessionRequest = await sessionPost(stubResponse.data.clientId, "");
		assertStatusCode(401, sessionRequest.status, sessionRequest.statusText);
		assertResponseMessage(sessionRequest, "Invalid request: Request failed to be decrypted");
	});

	it("E2E Negative Path Journey - Sessions: Empty Client ID", async () => {
		// Session Post
		const sessionRequest = await sessionPost("", stubResponse.data.request);
		assertStatusCode(400, sessionRequest.status, sessionRequest.statusText);
		assertResponseData(sessionRequest, "Missing client config");
	});

	it("E2E Negative Path Journey - Sessions: Incorrect Client ID", async () => {
		// Session Post
		const sessionRequest = await sessionPost("1A2B3C4D", stubResponse.data.request);
		assertStatusCode(400, sessionRequest.status, sessionRequest.statusText);
		assertResponseData(sessionRequest, "Missing client config");
	});

});

describe("E2E Negative Path Tests - Claimed Identity Endpoint", () => {
	let sessionId: any;
	beforeAll(async () => {
		const sessionResponse = await startStubServiceAndReturnSessionId();
		assertStatusCode(200, sessionResponse.status, sessionResponse.statusText);
		sessionId = sessionResponse.data.session_id;
	});

	it("E2E Negative Path Journey - Claimed Identity: No Name in Payload", async () => {
		// Session Post      
		const calimedIdentityResponse = await claimedIdentityPost(null, null, dataSlim.dateOfBirth, sessionId);
		assertStatusCode(400, calimedIdentityResponse.status, calimedIdentityResponse.statusText);
	});

	it("E2E Negative Path Journey - Claimed Identity: No DoB in Payload", async () => {
		// Session Post
		const calimedIdentityResponse = await claimedIdentityPost(dataSlim.firstName, dataSlim.lastName, null, sessionId);
		assertStatusCode(400, calimedIdentityResponse.status, calimedIdentityResponse.statusText);
	});

});
