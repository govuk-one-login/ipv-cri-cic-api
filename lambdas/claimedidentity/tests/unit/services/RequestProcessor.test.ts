import { RequestProcessor } from "../../../src/services/RequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { event } from "../data/events";
import { CicService } from "../../../src/services/CicService";
import { SessionItem } from "../../../src/models/SessionItem";
import { Response } from "../../../src/utils/Response";
import { CicResponse } from "../../../src/utils/CicResponse";

let requestProcessorTest: RequestProcessor;
const mockCicService = mock<CicService>();

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CIC",
});
const metrics = new Metrics({ namespace: "CIC" });

describe("RequestProcessor", () => {
	beforeAll(() => {
		requestProcessorTest = new RequestProcessor(logger, metrics);
		requestProcessorTest.cicService = mockCicService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("Return successful response with 200 OK when session is found", async () => {
		const sess: SessionItem = new SessionItem();
		sess.redirectUri = "http";
		mockCicService.getSessionById.mockResolvedValue(sess);

		const out: Response = await requestProcessorTest.processRequest(event, "1234");

		const cicResp = new CicResponse(JSON.parse(out.body));
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);

		expect(out.body).toEqual(JSON.stringify({
			authorizationCode: `${cicResp.authorizationCode}`,
			redirectUri: "http",
		}));
		expect(out.statusCode).toBe(200);
	});

	it("Return 404 when session with that session id not found in the DB", async () => {
		const sess: SessionItem = new SessionItem();
		sess.redirectUri = "http";
		mockCicService.getSessionById.mockResolvedValue(undefined);

		const out: Response = await requestProcessorTest.processRequest(event, "1234");

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("No session found with the session id: 1234");
		expect(out.statusCode).toBe(404);
	});
});
