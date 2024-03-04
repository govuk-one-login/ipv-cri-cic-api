import { stubStartPost, sessionPost, claimedIdentityPost, startStubServiceAndReturnSessionId } from "./ApiTestSteps";
import dataSlim from "../data/happyPathSlim.json";
import dataNumeric from "../data/dataNumeric.json";
import dataInvalidChar from "../data/dataInvalidChar.json";
import dataDoubleSpace from "../data/dataDoubleSpace.json";
import dataSpaceStart from "../data/dataSpaceStart.json";
import dataSpaceEnd from "../data/dataSpaceEnd.json";


describe("E2E Negative Path Tests - Sessions Endpoint", () => {
	let stubResponse: any;
	beforeAll(async () => {
		stubResponse = await stubStartPost("FACE_TO_FACE");
	});

	it("E2E Negative Path Journey - Sessions: Empty Request Body", async () => {
		// Session Post      
		const sessionRequest = await sessionPost(stubResponse.data.clientId, "");
		expect(sessionRequest.status).toBe(401);
		expect(sessionRequest.data.message).toBe("Unauthorized");
	});

	it("E2E Negative Path Journey - Sessions: Empty Client ID", async () => {
		// Session Post
		const sessionRequest = await sessionPost("", stubResponse.data.request);
		expect(sessionRequest.status).toBe(400);
		expect(sessionRequest.data).toBe("Bad Request");
	});

	it("E2E Negative Path Journey - Sessions: Incorrect Client ID", async () => {
		// Session Post
		const sessionRequest = await sessionPost("1A2B3C4D", stubResponse.data.request);
		expect(sessionRequest.status).toBe(400);
		expect(sessionRequest.data).toBe("Bad Request");
	});

});

describe("/session Unhappy Path", () => {
	it("Invalid 'context' test", async () => {
		const sessionResponse = await startStubServiceAndReturnSessionId("INVALID");
		expect(sessionResponse.status).toBe(401);
	});
});

describe("E2E Negative Path Tests - Claimed Identity Endpoint", () => {
	let sessionId: any;
	beforeAll(async () => {
		const sessionResponse = await startStubServiceAndReturnSessionId("FACE_TO_FACE");
		sessionId = sessionResponse.data.session_id;
	});

	it("E2E Negative Path Journey - Claimed Identity: No Name in Payload", async () => {
		// Session Post      
		console.log(sessionId);
		const claimedIdentityResponse = await claimedIdentityPost(null, null, dataSlim.dateOfBirth, sessionId);
		expect(claimedIdentityResponse.status).toBe(400);
	});

	it("E2E Negative Path Journey - Claimed Identity: No DoB in Payload", async () => {
		// Session Post
		const claimedIdentityResponse = await claimedIdentityPost(dataSlim.firstName, dataSlim.lastName, null, sessionId);
		expect(claimedIdentityResponse.status).toBe(400);
	});
});

describe("Claimed Identity Negative Path Tests", () => {

	it.each([
		[dataNumeric],
		[dataInvalidChar],
		[dataDoubleSpace],
		[dataSpaceStart],
		[dataSpaceEnd],
	])("E2E Happy Path Journey - User Info", async (userData: any) => {
		const sessionResponse = await startStubServiceAndReturnSessionId("FACE_TO_FACE");
		expect(sessionResponse.status).toBe(200);
		console.log(sessionResponse.data);
		const sessionId = sessionResponse.data.session_id;
		console.log(sessionId);
		expect(sessionId).toBeTruthy();
		// Claimed Identity
		const claimedIdentityResponse = await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
		expect(claimedIdentityResponse.status).toBe(400);
	});

});
