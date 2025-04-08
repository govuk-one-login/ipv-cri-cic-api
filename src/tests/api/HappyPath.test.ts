 

 
import userData from "../data/happyPathSlim.json";
import { constants } from "./ApiConstants";
import { abortPost, getSessionAndVerifyKey, startStubServiceAndReturnSessionId, wellKnownGet, claimedIdentityPost, authorizationGet, tokenPost, userInfoPost } from "./ApiTestSteps";
import { getTxmaEventsFromTestHarness, validateTxMAEventData } from "./ApiUtils";

describe("Happy path tests", () => {
	describe("/session endpoint", () => {
		it.each([
			{ journeyType: "f2f", schemaName: "CIC_CRI_START_SCHEMA" },
			{ journeyType: "bank_account", schemaName: "CIC_CRI_START_BANK_ACCOUNT_SCHEMA" },
			{ journeyType: "hmrc_check", schemaName: "CIC_CRI_START_LOW_CONFIDENCE_SCHEMA" },
		])("Successful Request Tests - authSessionState and TxMA event validation for $journeyType journey type", async ({ journeyType, schemaName }: { journeyType: string; schemaName: string }) => {
			const sessionId = await startStubServiceAndReturnSessionId(journeyType);

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "journey", journeyType);
			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_SESSION_CREATED");

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 1);
			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName }, allTxmaEventBodies);
		});
	});

	describe("/claimedIdentity endpoint", () => {
		it.each([
			{ journeyType: "f2f"},
			{ journeyType: "bank_account"},
			{ journeyType: "hmrc_check"},
		])("Successful Request Tests - authSessionState validation for $journeyType journey type", async ({ journeyType }: { journeyType: string}) => {
			const sessionId = await startStubServiceAndReturnSessionId(journeyType);

			const claimedIdentityResponse = await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
			expect(claimedIdentityResponse.status).toBe(200);

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_DATA_RECEIVED");
		});
	});

	describe("/authorization endpoint", () => {
		it.each([
			{ journeyType: "f2f", schemaName: "CIC_CRI_START_SCHEMA" },
			{ journeyType: "bank_account", schemaName: "CIC_CRI_START_BANK_ACCOUNT_SCHEMA" },
			{ journeyType: "hmrc_check", schemaName: "CIC_CRI_START_LOW_CONFIDENCE_SCHEMA" },
		])("Successful Request Tests - authSessionState and TxMA event validation for $journeyType journey type", async ({ journeyType, schemaName }: { journeyType: string; schemaName: string }) => {
			const sessionId = await startStubServiceAndReturnSessionId(journeyType);

			await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
			const authResponse = await authorizationGet(sessionId);
			expect(authResponse.status).toBe(200);

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_AUTH_CODE_ISSUED");

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 2);
			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName }, allTxmaEventBodies);
			validateTxMAEventData({ eventName: "CIC_CRI_AUTH_CODE_ISSUED", schemaName: "CIC_CRI_AUTH_CODE_ISSUED_SCHEMA" }, allTxmaEventBodies);
		});
	});

	describe("/token endpoint", () => {
		it.each([
			{ journeyType: "f2f"},
			{ journeyType: "bank_account"},
			{ journeyType: "hmrc_check"},
		])("Successful Request Tests - authSessionState validation for $journeyType journey type", async ({ journeyType }: { journeyType: string }) => {
			const sessionId = await startStubServiceAndReturnSessionId(journeyType);

			await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
			const authResponse = await authorizationGet(sessionId);
			const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
			expect(tokenResponse.status).toBe(200);

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_ACCESS_TOKEN_ISSUED");
		});
	});

	describe("/userinfo endpoint", () => {
		it.each([
			{ journeyType: "f2f", schemaName: "CIC_CRI_START_SCHEMA" },
			{ journeyType: "bank_account", schemaName: "CIC_CRI_START_BANK_ACCOUNT_SCHEMA" },
			{ journeyType: "hmrc_check", schemaName: "CIC_CRI_START_LOW_CONFIDENCE_SCHEMA" },
		])("Successful Request Tests - authSessionState validation for $journeyType journey type", async ({ journeyType, schemaName }: { journeyType: string; schemaName: string }) => {
			const sessionId = await startStubServiceAndReturnSessionId(journeyType);

			await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
			const authResponse = await authorizationGet(sessionId);
			const tokenResponse = await tokenPost(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri );
			const userInfoResponse = await userInfoPost(tokenResponse.data.access_token);
			expect(userInfoResponse.status).toBe(200);

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_ACCESS_TOKEN_ISSUED");

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 4);
			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName }, allTxmaEventBodies);
			validateTxMAEventData({ eventName: "CIC_CRI_AUTH_CODE_ISSUED", schemaName: "CIC_CRI_AUTH_CODE_ISSUED_SCHEMA" }, allTxmaEventBodies);
			validateTxMAEventData({ eventName: "CIC_CRI_END", schemaName: "CIC_CRI_END_SCHEMA" }, allTxmaEventBodies);
			validateTxMAEventData({ eventName: "CIC_CRI_VC_ISSUED", schemaName: "CIC_CRI_VC_ISSUED_SCHEMA" }, allTxmaEventBodies);
		});
	});

	it("./wellknown/jwks.json endpoint", async () => {
		const { status, data } = await wellKnownGet();

		expect(status).toBe(200);
		expect(data.keys).toHaveLength(2);
		expect(data.keys[0].use).toBe("sig");
		expect(data.keys[1].use).toBe("enc");
	});

	describe("/abort Endpoint", () => {
		let sessionId: string;

		beforeEach(async () => {
			sessionId = await startStubServiceAndReturnSessionId(userData.journeyType);

		});

		it("Successful Request Test - Abort After Session Request with authSessionState and TxMA event validation", async () => {
			const response = await abortPost(sessionId);
			expect(response.status).toBe(200);
			expect(response.data).toBe("Session has been aborted");

			expect(response.headers).toBeTruthy();
			expect(response.headers.location).toBeTruthy();

			const url = new URL(decodeURIComponent(response.headers.location));
			expect(url.searchParams.has("error")).toBe(true);
			expect(url.searchParams.has("state")).toBe(true);
			expect(url.searchParams.get("error")).toBe("access_denied");

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_CRI_SESSION_ABORTED");
			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "state", "" + url.searchParams.get("state"));

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 2);
			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName: "CIC_CRI_START_SCHEMA" }, allTxmaEventBodies);
			validateTxMAEventData({ eventName: "CIC_CRI_SESSION_ABORTED", schemaName: "CIC_CRI_SESSION_ABORTED_SCHEMA" }, allTxmaEventBodies);

		});

		it("Successful Request Test - Abort After Claimed Identity Request with authSessionState and TxMA event validation", async () => {

			// Claimed Identity
			const claimedIdentityResponse = await claimedIdentityPost(userData.firstName, userData.lastName, userData.dateOfBirth, sessionId);
			expect(claimedIdentityResponse.status).toBe(200);

			const response = await abortPost(sessionId);
			expect(response.status).toBe(200);
			expect(response.data).toBe("Session has been aborted");

			const url = new URL(decodeURIComponent(response.headers.location));
			expect(url.searchParams.has("error")).toBe(true);
			expect(url.searchParams.has("state")).toBe(true);
			expect(url.searchParams.get("error")).toBe("access_denied");

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_CRI_SESSION_ABORTED");

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 2);

			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName: "CIC_CRI_START_SCHEMA" }, allTxmaEventBodies);

			validateTxMAEventData({ eventName: "CIC_CRI_SESSION_ABORTED", schemaName: "CIC_CRI_SESSION_ABORTED_SCHEMA" }, allTxmaEventBodies);

			expect(response.headers).toBeTruthy();
			expect(response.headers.location).toBeTruthy();

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "state", "" + url.searchParams.get("state"));
		});

	});
});

