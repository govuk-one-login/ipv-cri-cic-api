import { stubStartPost, sessionPost } from "../utils/ApiTestSteps";
import { assertStatusCode, assertResponseMessage, assertResponseData } from "../utils/ApiHelper";


describe("E2E Negative Path Tests - Sessions Endpoint", () => {
	let stubResponse: any;
	beforeAll(async () => {
		stubResponse = await stubStartPost();
	});

	it("E2E Negative Path Journey - Sessions: Empty Request Body", async () => {
		// Session Post      
		const sessionRequest = await sessionPost(stubResponse.data.clientId, "");
		assertStatusCode(401, sessionRequest.status, sessionRequest.statusText);
		assertResponseMessage(sessionRequest, "Invalid request: Request failed to be decrypted");
	});

	it("E2E Negative Path Journey - Sessions: Empty Client ID", async () => {
		// Session Post
		const sessionRequest = await sessionPost("", stubResponse.data.request);
		assertStatusCode(400, sessionRequest.status, sessionRequest.statusText);
		assertResponseData(sessionRequest, "Missing client config");
	});

	it("E2E Negative Path Journey - Sessions: Incorrect Client ID", async () => {
		// Session Post
		const sessionRequest = await sessionPost("1A2B3C4D", stubResponse.data.request);
		assertStatusCode(400, sessionRequest.status, sessionRequest.statusText);
		assertResponseData(sessionRequest, "Missing client config");
	});

});
