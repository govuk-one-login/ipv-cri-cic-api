import { constants } from "./ApiConstants";
import { getKeyFromSession, startStubServiceAndReturnSessionId, wellKnownGet, abortPost } from "./ApiTestSteps";
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

	describe("E2E Happy Path /abort endpoint", () => {
		let sessionId: string;
		beforeEach(async () => {
			const sessionResponse = await startStubServiceAndReturnSessionId("FACE_TO_FACE");
			sessionId = sessionResponse.data.session_id;
			console.log("session id: " + sessionId);
		});
	
		it("E2E Happy Path Journey - Abort Previously Aborted Session", async () => {
			expect(sessionId).toBeTruthy();
			const response = await abortPost(sessionId);
			
			expect(response.headers.location).toContain("%2Fredirect%3Ferror%3Daccess_denied%26state%3D");
			const secondResponse = await abortPost(sessionId);

			expect(secondResponse.status).toBe(200);
			expect(secondResponse.data).toBe("Session has already been aborted");
		});
	});
});
