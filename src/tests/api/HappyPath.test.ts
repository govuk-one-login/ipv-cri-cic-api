import { constants } from "../utils/ApiConstants";
import { getKeyFromSession, startStubServiceAndReturnSessionId, validateCriStartTxMAEvent, getSqsEventList } from "../utils/ApiTestSteps";


describe("/session Happy Path", () => {
	it.each([
		["FACE_TO_FACE"],
		["NO_PHOTO_ID"],
	])("BAV and F2F test", async (journeyType: any) => {
		const sessionResponse = await startStubServiceAndReturnSessionId(journeyType);
		expect(sessionResponse.status).toBe(200);
		const sessionId = sessionResponse.data.session_id;
		console.log(sessionId);
		await expect(getKeyFromSession(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "journey")).resolves.toBe(journeyType);
	});
});

describe("Happy Path - CIC_CRI_START Event Check", () => {
	it.each([
		["NO_PHOTO_ID", "bank_account"],
	])("BAV and F2F test", async (journeyType: any, context: string) => {
		const sessionResponse = await startStubServiceAndReturnSessionId(journeyType);
		expect(sessionResponse.status).toBe(200);
		const sessionId = sessionResponse.data.session_id;
		// Validate CIC_CRI_START TxMA Event
		const sqsMessage = await getSqsEventList("txma/", sessionId, 1);
		await validateCriStartTxMAEvent(sqsMessage, context);
	});
});
