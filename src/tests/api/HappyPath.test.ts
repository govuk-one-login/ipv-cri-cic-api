/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable max-lines-per-function */
import { constants } from "./ApiConstants";
import { abortPost, getKeyFromSession, getSessionAndVerifyKey, startStubServiceAndReturnSessionId, wellKnownGet } from "./ApiTestSteps";
import { getTxmaEventsFromTestHarness, validateTxMAEventData } from "./ApiUtils";

describe("Happy path tests", () => {
	describe("/session endpoint", () => {
		it.each([
			{ journeyType: "FACE_TO_FACE", schemaName: "CIC_CRI_START_SCHEMA" },
			{ journeyType: "NO_PHOTO_ID", schemaName: "CIC_CRI_START_BANK_ACCOUNT_SCHEMA" },
		])("For $journeyType journey type", async ({ journeyType, schemaName }: { journeyType: string; schemaName: string }) => {
			const sessionResponse = await startStubServiceAndReturnSessionId(journeyType);
			const sessionId = sessionResponse.data.session_id;

			const savedJourney = getKeyFromSession(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "journey");
			await expect(savedJourney).resolves.toBe(journeyType);

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 1);
			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName }, allTxmaEventBodies);
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
			sessionId = await startStubServiceAndReturnSessionId();
		});

		it("Successful Request Test - Abort After Session Request", async () => {
			const response = await abortPost(sessionId);
			expect(response.status).toBe(200);
			expect(response.data).toBe("Session has been aborted");

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_CRI_SESSION_ABORTED");

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 2);
			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName: "CIC_CRI_START_SCHEMA" }, allTxmaEventBodies);
			validateTxMAEventData({ eventName: "CIC_CRI_SESSION_ABORTED", schemaName: "CIC_CRI_SESSION_ABORTED_SCHEMA" }, allTxmaEventBodies);

			expect(response.headers).toBeTruthy();
			expect(response.headers.location).toBeTruthy();

			const responseURI = decodeURIComponent(response.headers.location);
			const responseURIParameters = new URLSearchParams(responseURI);
			expect(responseURIParameters.has("error")).toBe(true);
			expect(responseURIParameters.has("state")).toBe(true);
			expect(responseURIParameters.get("error")).toBe("access_denied");

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "state", "" + responseURIParameters.get("state"));
		});

		it("Successful Request Test - Abort After Verify Account Request", async () => {
			const response = await abortPost(sessionId);
			expect(response.status).toBe(200);
			expect(response.data).toBe("Session has been aborted");

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "authSessionState", "CIC_CRI_SESSION_ABORTED");

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 4);

			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName: "CIC_CRI_START_SCHEMA" }, allTxmaEventBodies);

			validateTxMAEventData({ eventName: "CIC_CRI_SESSION_ABORTED", schemaName: "CIC_CRI_SESSION_ABORTED_SCHEMA" }, allTxmaEventBodies);

			expect(response.headers).toBeTruthy();
			expect(response.headers.location).toBeTruthy();

			const responseURI = decodeURIComponent(response.headers.location);
			const responseURIParameters = new URLSearchParams(responseURI);
			expect(responseURIParameters.has("error")).toBe(true);
			expect(responseURIParameters.has("state")).toBe(true);
			expect(responseURIParameters.get("error")).toBe("access_denied");

			await getSessionAndVerifyKey(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "state", "" + responseURIParameters.get("state"));
		});
	
	});
});

