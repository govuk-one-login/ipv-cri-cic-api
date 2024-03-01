/* eslint-disable max-lines-per-function */
import dataSlim from "../data/happyPathSlim.json";
import dataBjorn from "../data/happyPathBjörn.json";
import dataManuel from "../data/happyPathManuel.json";
import dataBillyJoe from "../data/happyPathBillyJoe.json";
import {
	authorizationGet,
	claimedIdentityPost,
	tokenPost,
	userInfoPost,
	validateJwtToken,
	wellKnownGet,
	validateWellKnownResponse,
	getTxmaEventsFromTestHarness,
	validateTxMAEventData,
	sessionConfigGet,
	startStubServiceAndReturnSessionId,
} from "../utils/ApiTestSteps";


describe("E2E Happy Path Tests", () => {
	it.only.each([
		[dataSlim],
		// [dataBjorn],
		// [dataManuel],
		// [dataBillyJoe],
	])("E2E Happy Path Journey - User Info", async (userData: any) => {
		const sessionResponse = await startStubServiceAndReturnSessionId(userData.journeyType);
		expect(sessionResponse.status).toBe(200);

		const sessionId = sessionResponse.data.session_id;
		console.log("sessionId", sessionId);

		// Session Config
		const sessionConfigResponse = await sessionConfigGet(sessionId);
		expect(sessionConfigResponse.status).toBe(200);
		expect(sessionConfigResponse.data.journey_type).toBe(userData.journeyType);

		// Claimed Identity
		const claimedIdentityResponse = await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
		expect(claimedIdentityResponse.status).toBe(200);

		// Authorization
		const authResponse = await authorizationGet(sessionId);
		expect(authResponse.status).toBe(200);

		// Post Token
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
		expect(tokenResponse.status).toBe(200);

		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		expect(userInfoResponse.status).toBe(200);
		validateJwtToken(JSON.stringify(userInfoResponse.data), userData);
		
		// Validate TxMA Queue
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 4);
		validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName: "CIC_CRI_START_SCHEMA.json" }, allTxmaEventBodies);
		// validateTxMAEventData({ eventName: "CIC_CRI_AUTH_CODE_ISSUED", schemaName: "CIC_CRI_AUTH_CODE_ISSUED_SCHEMA.json" }, allTxmaEventBodies);
		// validateTxMAEventData({ eventName: "CIC_CRI_END", schemaName: "CIC_CRI_END_SCHEMA.json" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_VC_ISSUED", schemaName: "CIC_CRI_VC_ISSUED_SCHEMA.json" }, allTxmaEventBodies);
	}, 20000);
});

describe("E2E Happy Path Well Known Endpoint", () => {
	it("E2E Happy Path Journey - Well Known", async () => {
		// Well Known
		const wellKnownResponse = await wellKnownGet();
		validateWellKnownResponse(wellKnownResponse.data);
		expect(wellKnownResponse.status).toBe(200);
	});
});
