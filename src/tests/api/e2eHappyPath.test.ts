 
import dataSlim from "../data/happyPathSlim.json";
import dataBjorn from "../data/happyPathBjörn.json";
import dataManuel from "../data/happyPathManuel.json";
import dataBillyJoe from "../data/happyPathBillyJoe.json";
import dataKenneth from "../data/happyPathKenneth.json";
import {
	authorizationGet,
	claimedIdentityPost,
	tokenPost,
	userInfoPost,
	validateJwtToken,
	sessionConfigGet,
	startStubServiceAndReturnSessionId,
	startTokenPost,
} from "./ApiTestSteps";
import { getTxmaEventsFromTestHarness, validateTxMAEventData } from "./ApiUtils";

//QualityGateIntegrationTest 
//QualityGateRegressionTest
describe("E2E Happy Path Tests", () => {
	it.each([
		[dataSlim],
		[dataBjorn],
	])("E2E CIC journey (F2F Journey Type) with Verifiable Credential and TxMA Event Validation", async (userData: any) => {
		const sessionId = await startStubServiceAndReturnSessionId(userData.journeyType);
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
		const startTokenResponse = await startTokenPost();
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri, startTokenResponse.data);
		expect(tokenResponse.status).toBe(200);

		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		expect(userInfoResponse.status).toBe(200);
		await validateJwtToken(JSON.stringify(userInfoResponse.data), userData);

		// Validate TxMA Queue
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 4);
		validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName: "CIC_CRI_START_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_AUTH_CODE_ISSUED", schemaName: "CIC_CRI_AUTH_CODE_ISSUED_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_END", schemaName: "CIC_CRI_END_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_VC_ISSUED", schemaName: "CIC_CRI_VC_ISSUED_SCHEMA" }, allTxmaEventBodies);
	}, 20000);

	it.each([
		[dataManuel],
		[dataBillyJoe],
	])("E2E CIC journey (NoPhotoID/Bank Account Journey Type) with Verifiable Credential and TxMA Event Validation", async (userData: any) => {
		const sessionId = await startStubServiceAndReturnSessionId(userData.journeyType);
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
		const startTokenResponse = await startTokenPost();
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri, startTokenResponse.data);
		expect(tokenResponse.status).toBe(200);

		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		expect(userInfoResponse.status).toBe(200);
		await validateJwtToken(JSON.stringify(userInfoResponse.data), userData);

		// Validate TxMA Queue
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 4);
		validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName: "CIC_CRI_START_BANK_ACCOUNT_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_AUTH_CODE_ISSUED", schemaName: "CIC_CRI_AUTH_CODE_ISSUED_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_END", schemaName: "CIC_CRI_END_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_VC_ISSUED", schemaName: "CIC_CRI_VC_ISSUED_SCHEMA" }, allTxmaEventBodies);
	}, 20000);

	it.each([
		[dataKenneth],
	])("E2E CIC journey (Low Confidence/HMRC Check Journey Type) with Verifiable Credential and TxMA Event Validation", async (userData: any) => {
		const sessionId = await startStubServiceAndReturnSessionId(userData.journeyType);
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
		const startTokenResponse = await startTokenPost();
		const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri, startTokenResponse.data);
		expect(tokenResponse.status).toBe(200);

		// Post User Info
		const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
		expect(userInfoResponse.status).toBe(200);
		await validateJwtToken(JSON.stringify(userInfoResponse.data), userData);

		// Validate TxMA Queue
		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 4);
		validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName: "CIC_CRI_START_LOW_CONFIDENCE_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_AUTH_CODE_ISSUED", schemaName: "CIC_CRI_AUTH_CODE_ISSUED_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_END", schemaName: "CIC_CRI_END_SCHEMA" }, allTxmaEventBodies);
		validateTxMAEventData({ eventName: "CIC_CRI_VC_ISSUED", schemaName: "CIC_CRI_VC_ISSUED_SCHEMA" }, allTxmaEventBodies);
	}, 20000);
});

