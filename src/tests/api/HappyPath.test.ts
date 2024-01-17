import { constants } from "../utils/ApiConstants";
import { getKeyFromSession, startStubServiceAndReturnSessionIdByType } from "../utils/ApiTestSteps";



describe("/session Happy Path", () => {
	it("BAV | NO_PHOTO_ID test", async () => {
		const sessionResponse = await startStubServiceAndReturnSessionIdByType("FACE_TO_FACE");
		expect(sessionResponse.status).toBe(200);
		console.log(sessionResponse.data);
		const sessionId = sessionResponse.data.session_id;
		console.log(sessionId);
        expect(await getKeyFromSession(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "journey")).toBe("FACE_TO_FACE");
	});

	it("F2F | FACE_TO_FACE test", async () => {
		const sessionResponse = await startStubServiceAndReturnSessionIdByType("NO_PHOTO_ID");
		expect(sessionResponse.status).toBe(200);
		console.log(sessionResponse.data);
		const sessionId = sessionResponse.data.session_id;
		console.log(sessionId);
        expect(await getKeyFromSession(sessionId, constants.DEV_CIC_SESSION_TABLE_NAME, "journey")).toBe("NO_PHOTO_ID");
	});
});