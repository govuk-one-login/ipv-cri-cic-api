import { ClaimedIdRequestProcessor } from "../../../services/ClaimedIdRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { VALID_CLAIMEDID } from "../data/events";
import { CicService } from "../../../services/CicService";
import { ISessionItem } from "../../../models/ISessionItem";
import { Response } from "../../../utils/Response";
import { CicResponse } from "../../../utils/CicResponse";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";

let requestProcessorTest: ClaimedIdRequestProcessor;
const mockCicService = mock<CicService>();

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CIC",
});
const metrics = new Metrics({ namespace: "CIC" });
class Session implements ISessionItem {
	accessToken = "123";

	accessTokenExpiryDate = 0;

	attemptCount = 0;

	authorizationCodeExpiryDate = 0;

	clientId = "ipv-core-stub";

	clientIpAddress = "51.149.8.130";

	clientSessionId = "aa995cfb-5f85-4934-959b-6719a657c8bd";

	createdDate = 1675443004;

	expiryDate = 221848913376;

	persistentSessionId = "ce44066e-e6a4-4434-9fe5-e09821be50c1";

	redirectUri = "http://localhost:8085/callback";

	state = "YpKACK4sgrVqjtBxYQSD07jFwfWhbewedpvyPkXZ7NA";

	subject = "urn:fdc:gov.uk:2022:d1bdf4c6-1358-4bb3-8fea-bf6b330fd7fa";

	authorizationCode = "1234";

	cicSession = {
		fullName:"Test",
		dateOfBirth:"data.dateOfBirth!",
		documentSelected: "Passport",
		dateOfExpiry: "data.dateOfExpiry!",
	};

	sessionId = "01333e01-dde3-412f-a484-e9f23b06be3e";


}


describe("RequestProcessor", () => {
	beforeAll(() => {
		requestProcessorTest = new ClaimedIdRequestProcessor(logger, metrics);
		// @ts-ignore
		requestProcessorTest.cicService = mockCicService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("Return successful response with 200 OK when session is found", async () => {
		mockCicService.getSessionById.mockResolvedValue(new Session());

		const out: Response = await requestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");
		const cicResp = new CicResponse(JSON.parse(out.body));
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);

		expect(out.body).toEqual(JSON.stringify({
			authorizationCode: `${cicResp.authorizationCode}`,
			redirect_uri: "http://localhost:8085/callback",
			state: "YpKACK4sgrVqjtBxYQSD07jFwfWhbewedpvyPkXZ7NA",
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});

	it("Return 401 when session is expired", async () => {
		const sess = new Session();
		sess.expiryDate = 1675458564;
		mockCicService.getSessionById.mockResolvedValue(sess);

		const out: Response = await requestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");
		//const cicResp = new CicResponse(JSON.parse(out.body));
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("Session with session id: 1234 has expired");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
	});

	it("Return 401 when session with that session id not found in the DB", async () => {
		mockCicService.getSessionById.mockResolvedValue(undefined);

		const out: Response = await requestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("No session found with the session id: 1234");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
	});
});
