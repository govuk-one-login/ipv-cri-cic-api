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
});
