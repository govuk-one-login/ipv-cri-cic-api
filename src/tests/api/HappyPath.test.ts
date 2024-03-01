import { constants } from "../utils/ApiConstants";
import { getKeyFromSession,
	startStubServiceAndReturnSessionId,
	validateTxMAEventData,
	getTxmaEventsFromTestHarness,
	wellKnownGet,
} from "../utils/ApiTestSteps";

describe("Happy path tests", () => {
	describe("/session endpoint", () => {
		it.each([
			{ journeyType: "FACE_TO_FACE", schemaName: "CIC_CRI_START_SCHEMA" },
			{ journeyType: "NO_PHOTO_ID", schemaName: "CIC_CRI_START_BANK_ACCOUNT_SCHEMA" },
		])("For $journeyType journey type", async ({ journeyType, schemaName }: { journeyType: string; schemaName: string }) => {
			const sessionResponse = await startStubServiceAndReturnSessionId(journeyType);
			const sessionId = sessionResponse.data.session_id;

			await expect(getKeyFromSession(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "journey")).resolves.toBe(journeyType);

			const allTxmaEventBodies = await getTxmaEventsFromTestHarness(sessionId, 1);
			validateTxMAEventData({ eventName: "CIC_CRI_START", schemaName }, allTxmaEventBodies);
		});
	});

	describe("./wellknown/jwks.json endpoint", () => {
		it("E2E Happy Path Journey - Well Known", async () => {
			const { status, data } = await wellKnownGet();
			
			expect(status).toBe(200);
			expect(data.keys).toHaveLength(2);
			expect(data.keys[0].use).toBe("sig");
			expect(data.keys[1].use).toBe("enc");
		});
	});
});
