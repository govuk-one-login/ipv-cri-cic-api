import * as dataSlim from "../data/happyPathSlim.json";
import * as dataBjorn from "../data/happyPathBjörn.json";
import { assertStatusCode } from "../utils/ApiHelper";
import { authorizationGet, claimedIdentityPost, tokenPost, startStubServiceAndReturnSessionId, wellKnownGet, userInfoPost, validateJwtToken, validateWellKnownReponse } from "../utils/ApiTestSteps";


describe("E2E Happy Path Tests Slim", () => {
	let sessionId: any;
	beforeAll(async () => {
		const sessionResponse = await startStubServiceAndReturnSessionId();
		assertStatusCode(200, sessionResponse.status, sessionResponse.statusText);
		sessionId = sessionResponse.data.session_id;
	});

	it("E2E Happy Path Journey - User Info Slim", async () => {
		expect(sessionId).toBeTruthy();
		// Claimed Identity
		const calimedIdentityResponse = await claimedIdentityPost(dataSlim.firstName, dataSlim.lastName, dataSlim.dateOfBirth, dataSlim.identityType, dataSlim.dateOfExpiry, sessionId);
		assertStatusCode(200, calimedIdentityResponse.status, calimedIdentityResponse.statusText);
		// Authorization
		const authResponse = await authorizationGet(sessionId);
		assertStatusCode(200, authResponse.status, authResponse.statusText);
		// Post Token
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
		assertStatusCode(201, tokenResponse.status, tokenResponse.statusText);
		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		validateJwtToken(JSON.stringify(userInfoResponse.data), dataSlim);
		assertStatusCode(200, userInfoResponse.status, userInfoResponse.statusText);
	});

});

describe("E2E Happy Path Tests Björn", () => {
	let sessionId: any;
	beforeAll(async () => {
		const sessionResponse = await startStubServiceAndReturnSessionId();
		assertStatusCode(200, sessionResponse.status, sessionResponse.statusText);
		sessionId = sessionResponse.data.session_id;
	});

	it("E2E Happy Path Journey - User Info Björn", async () => {
		expect(sessionId).toBeTruthy();
		// Claimed Identity
		const calimedIdentityResponse = await claimedIdentityPost(dataBjorn.firstName, dataBjorn.lastName, dataBjorn.dateOfBirth, dataBjorn.identityType, dataBjorn.dateOfExpiry, sessionId);
		assertStatusCode(200, calimedIdentityResponse.status, calimedIdentityResponse.statusText);
		// Authorization
		const authResponse = await authorizationGet(sessionId);
		assertStatusCode(200, authResponse.status, authResponse.statusText);
		// Post Token
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
		assertStatusCode(201, tokenResponse.status, tokenResponse.statusText);
		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		validateJwtToken(JSON.stringify(userInfoResponse.data), dataBjorn);
		assertStatusCode(200, userInfoResponse.status, userInfoResponse.statusText);
	});

});

describe("E2E Happy Path Well Known Endpoint", () => {
	it("E2E Happy Path Journey - Well Known", async () => {
		// Well Known
		const wellKnownResponse = await wellKnownGet();
		validateWellKnownReponse(wellKnownResponse.data);
		assertStatusCode(200, wellKnownResponse.status, wellKnownResponse.statusText);
	});
});
