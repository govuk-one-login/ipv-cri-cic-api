import dataSlim from "../data/happyPathSlim.json";
import dataBjorn from "../data/happyPathBjörn.json";
import dataManuel from "../data/happyPathManuel.json";
import dataBillyJoe from "../data/happyPathBillyJoe.json";
import {
	authorizationGet,
	claimedIdentityPost,
	tokenPost,
	startStubServiceAndReturnSessionId,
	userInfoPost,
	validateJwtToken,
	wellKnownGet,
	validateWellKnownResponse,
	getSqsEventList,
	validateTxMAEventData,
} from "../utils/ApiTestSteps";


describe("E2E Happy Path Tests", () => {
	jest.setTimeout(60000);

	it.each([
		[dataSlim],
		[dataBjorn],
		[dataManuel],
		[dataBillyJoe],
	])("E2E Happy Path Journey - User Info", async (userData: any) => {
		const sessionResponse = await startStubServiceAndReturnSessionId();
		console.log(sessionResponse.data);
		const sessionId = sessionResponse.data.session_id;
		console.log(sessionId);
		expect(sessionId).toBeTruthy();
		// Claimed Identity
		const claimedIdentityResponse = await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
		expect(claimedIdentityResponse.status).toBe(200);
		// Authorization
		const authResponse = await authorizationGet(sessionId);
		console.log(authResponse.data);
		expect(authResponse.status).toBe(200);
		// Post Token
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
		expect(tokenResponse.status).toBe(200);
		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		validateJwtToken(JSON.stringify(userInfoResponse.data), userData);
		expect(userInfoResponse.status).toBe(200);
		// Validate TxMA Queue
		let sqsMessage;
		do {
			sqsMessage = await getSqsEventList("txma/", sessionId, 4);
		} while (!sqsMessage);
		await validateTxMAEventData(sqsMessage);
	});
});

describe("E2E Happy Path Well Known Endpoint", () => {
	it("E2E Happy Path Journey - Well Known", async () => {
		// Well Known
		const wellKnownResponse = await wellKnownGet();
		validateWellKnownResponse(wellKnownResponse.data);
		expect(wellKnownResponse.status).toBe(200);
	});
});
