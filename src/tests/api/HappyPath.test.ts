import { constants } from "../utils/ApiConstants";
import { getKeyFromSession, startStubServiceAndReturnSessionId, validateTxMAEventData, getTxmaEventsFromTestHarness } from "../utils/ApiTestSteps";

describe("/session Happy Path", () => {
	it.each([
		{ journeyType: "FACE_TO_FACE", schemaName: "CIC_CRI_START_SCHEMA.json" },
		// { journeyType: "NO_PHOTO_ID", schemaName: "CIC_CRI_START_BANK_ACCOUNT_SCHEMA.json" },
	])("For $journeyType journey type", async ({ journeyType, schemaName }: { journeyType: string; schemaName: string }) => {
		const sessionResponse = await startStubServiceAndReturnSessionId(journeyType);
		const sessionId = sessionResponse.data.session_id;

		await expect(getKeyFromSession(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "journey")).resolves.toBe(journeyType);

		const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 1);
		validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName }, allTxmaEventBodies);
	});
});
