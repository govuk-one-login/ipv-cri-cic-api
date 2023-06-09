import * as dataSlim from "../data/happyPathSlim.json";
import * as dataBjorn from "../data/happyPathBjörn.json";
import { authorizationGet, claimedIdentityPost, tokenPost, startStubServiceAndReturnSessionId, wellKnownGet, userInfoPost, validateJwtToken, validateWellKnownReponse } from "../utils/ApiTestSteps";


describe("E2E Happy Path Tests Slim", () => {
	let sessionId: any;
	beforeAll(async () => {
		const sessionResponse = await startStubServiceAndReturnSessionId();
		sessionId = sessionResponse.data.session_id;
	});

	it("E2E Happy Path Journey - User Info Slim", async () => {
		expect(sessionId).toBeTruthy();
		// Claimed Identity
		const calimedIdentityResponse = await claimedIdentityPost(dataSlim.firstName, dataSlim.lastName, dataSlim.dateOfBirth, sessionId);
		expect(calimedIdentityResponse.status).toBe(200);
		// Authorization
		const authResponse = await authorizationGet(sessionId);
		expect(authResponse.status).toBe(200);
		// Post Token
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
		expect(tokenResponse.status).toBe(200);
		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		validateJwtToken(JSON.stringify(userInfoResponse.data), dataSlim);
		expect(userInfoResponse.status).toBe(200);
	});

});

describe("E2E Happy Path Tests Björn", () => {
	let sessionId: any;
	beforeAll(async () => {
		const sessionResponse = await startStubServiceAndReturnSessionId();
		sessionId = sessionResponse.data.session_id;
	});

	it("E2E Happy Path Journey - User Info Björn", async () => {
		expect(sessionId).toBeTruthy();
		// Claimed Identity
		const calimedIdentityResponse = await claimedIdentityPost(dataBjorn.firstName, dataBjorn.lastName, dataBjorn.dateOfBirth, sessionId);
		expect(calimedIdentityResponse.status).toBe(200);
		// Authorization
		const authResponse = await authorizationGet(sessionId);
		expect(authResponse.status).toBe(200);
		// Post Token
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
		expect(tokenResponse.status).toBe(200);
		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		validateJwtToken(JSON.stringify(userInfoResponse.data), dataBjorn);
		expect(userInfoResponse.status).toBe(200);
	});

});

describe("E2E Happy Path Well Known Endpoint", () => {
	it("E2E Happy Path Journey - Well Known", async () => {
		// Well Known
		const wellKnownResponse = await wellKnownGet();
		console.log(wellKnownResponse.data);
		validateWellKnownReponse(wellKnownResponse.data);
		expect(wellKnownResponse.status).toBe(200);
	});
});
