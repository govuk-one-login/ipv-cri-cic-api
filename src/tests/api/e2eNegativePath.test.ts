import { stubStartPost, sessionPost, claimedIdentityPost, startStubServiceAndReturnSessionId, authorizationGet, startTokenPost, tokenPost } from "./ApiTestSteps";
import dataSlim from "../data/happyPathSlim.json";
import dataNumeric from "../data/dataNumeric.json";
import dataInvalidChar from "../data/dataInvalidChar.json";
import dataDoubleSpace from "../data/dataDoubleSpace.json";
import dataSpaceStart from "../data/dataSpaceStart.json";
import dataSpaceEnd from "../data/dataSpaceEnd.json";

//QualityGateIntegrationTest 
//QualityGateRegressionTest
describe("E2E Negative Path Tests - Sessions Endpoint", () => {
	let stubResponse: any;
	beforeAll(async () => {
		stubResponse = await stubStartPost("f2f");
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

	it.each([
		{ journeyType: "f2f" },
		{ journeyType: "bank_account" },
		{ journeyType: "hmrc_check" },
	])("JWT signature not verified using Core's signing key - Invalid kid", async ({ journeyType }: { journeyType: string }) => {
		const stubResponse = await stubStartPost(journeyType, { journeyOptions: 'invalidSigningKid'});
		const sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);
		expect(sessionResponse.status).toBe(401);
		expect(sessionResponse.data.message).toBe('Unauthorized'); 
	});

	it.each([
		{ journeyType: "f2f" },
		{ journeyType: "bank_account" },
		{ journeyType: "hmrc_check" },
	])("JWT signature not verified using Core's signing key - Missing kid", async ({ journeyType }: { journeyType: string }) => {
		const stubResponse = await stubStartPost(journeyType, { journeyOptions: 'missingSigningKid'});
		const sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);
		expect(sessionResponse.status).toBe(401);
		expect(sessionResponse.data.message).toBe('Unauthorized'); 
	});

});

describe("/session Unhappy Path", () => {
	it("Invalid 'context' test", async () => {
		const stubResponse = await stubStartPost("INVALID");
		const sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);
		expect(sessionResponse.status).toBe(401);
	});
});

describe("E2E Negative Path Tests - Claimed Identity Endpoint", () => {
	let sessionId: any;
	beforeAll(async () => {
		sessionId = await startStubServiceAndReturnSessionId("f2f");
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

describe("E2E Negative Path Tests - Token Endpoint", () => {
	let sessionId: any;
	beforeAll(async () => {
		sessionId = await startStubServiceAndReturnSessionId("f2f");
	});

	it("E2E Negative Path Journey - Token: Invalid Kid in /token JWT", async () => {
		console.log(sessionId);
	  
		const userData = dataSlim;
	  
		await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
		const authResponse = await authorizationGet(sessionId);
		const startTokenResponse = await startTokenPost({ journeyOptions: 'invalidSigningKid' });
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri, startTokenResponse.data);
		expect(tokenResponse.status).toBe(401);
		expect(tokenResponse.data).toBe("Unauthorized");
	  });
	  

	it("E2E Negative Path Journey - Token: Missing Kid in /token JWT", async () => {
		console.log(sessionId);
	  
		const userData = dataSlim;
	  
		await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
		const authResponse = await authorizationGet(sessionId);
		const startTokenResponse = await startTokenPost({ journeyOptions: 'missingSigningKid' });
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri, startTokenResponse.data);
		expect(tokenResponse.status).toBe(401);
		expect(tokenResponse.data).toBe("Unauthorized");
	  });

	  it("E2E Negative Path Journey - Token: Request does not include client_assertion", async () => {
		console.log(sessionId);
	  
		const userData = dataSlim;
	  
		await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
		const authResponse = await authorizationGet(sessionId);
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri, "");
		expect(tokenResponse.status).toBe(401);
		expect(tokenResponse.data).toBe("Invalid request: Missing client_assertion parameter");
	  });

	  it("E2E Negative Path Journey - Token: Request does not include client_assertion_type", async () => {
		console.log(sessionId);
	  
		const userData = dataSlim;
	  
		await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
		const authResponse = await authorizationGet(sessionId);
		const startTokenResponse = await startTokenPost();
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri, startTokenResponse.data, " ");
		expect(tokenResponse.status).toBe(401);
		expect(tokenResponse.data).toBe("Invalid client_assertion_type parameter");
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
		const stubResponse = await stubStartPost("f2f");
		const sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);

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
