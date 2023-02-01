import { ClaimedIdRequestProcessor } from "../../../services/ClaimedIdRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { VALID_CLAIMEDID } from "../data/events";
import { CicService } from "../../../services/CicService";
import { SessionItem } from "../../../models/SessionItem";
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
		const sess: SessionItem = new SessionItem();
		sess.redirectUri = "http";
		mockCicService.getSessionById.mockResolvedValue(sess);

		const out: Response = await requestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");

		const cicResp = new CicResponse(JSON.parse(out.body));
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);

		expect(out.body).toEqual(JSON.stringify({
			authorizationCode: `${cicResp.authorizationCode}`,
			redirectUri: "http",
		}));
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});

	it("Return 404 when session with that session id not found in the DB", async () => {
		const sess: SessionItem = new SessionItem();
		sess.redirectUri = "http";
		mockCicService.getSessionById.mockResolvedValue(undefined);

		const out: Response = await requestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("No session found with the session id: 1234");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
	});
});
