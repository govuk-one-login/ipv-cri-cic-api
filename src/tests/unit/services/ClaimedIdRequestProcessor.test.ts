/* eslint-disable @typescript-eslint/unbound-method */
import { ClaimedIdRequestProcessor } from "../../../services/ClaimedIdRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { VALID_CLAIMEDID } from "../data/cic-events";
import { CicService } from "../../../services/CicService";
import { ISessionItem } from "../../../models/ISessionItem";
import { Response } from "../../../utils/Response";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { AuthSessionState } from "../../../models/enums/AuthSessionState";
import { MessageCodes } from "../../../models/enums/MessageCodes";

let claimedIdRequestProcessorTest: ClaimedIdRequestProcessor;
const mockCicService = mock<CicService>();

const logger = mock<Logger>();

const metrics = new Metrics({ namespace: "CIC" });

function getMockSessionItem(): ISessionItem {
	const session: ISessionItem = {
		sessionId: "sdfsdg",
		clientId: "ipv-core-stub",
		accessToken: "AbCdEf123456",
		clientSessionId: "sdfssg",
		authorizationCode: "",
		authorizationCodeExpiryDate: 0,
		redirectUri: "http://localhost:8085/callback",
		accessTokenExpiryDate: 0,
		expiryDate: 221848913376,
		createdDate: 1675443004,
		state: "Y@atr",
		subject: "sub",
		persistentSessionId: "sdgsdg",
		clientIpAddress: "127.0.0.1",
		attemptCount: 1,
		authSessionState: AuthSessionState.CIC_SESSION_CREATED,
	};
	return session;
}

describe("ClaimedIdRequestProcessor", () => {
	beforeAll(() => {
		claimedIdRequestProcessorTest = new ClaimedIdRequestProcessor(logger, metrics);
		// @ts-ignore
		claimedIdRequestProcessorTest.cicService = mockCicService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("Return successful response with 200 OK when session is found", async () => {
		const session = getMockSessionItem();
		mockCicService.getSessionById.mockResolvedValue(session);

		const out: Response = await claimedIdRequestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");
		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("");
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(logger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: session.clientSessionId });
	});

	it("Return 401 when session is expired", async () => {
		const session = getMockSessionItem();
		session.expiryDate = 1675458564;
		mockCicService.getSessionById.mockResolvedValue(session);

		const out: Response = await claimedIdRequestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("Session with session id: 1234 has expired");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith("Session has expired", { messageCode: MessageCodes.EXPIRED_SESSION });
	});

	it("Return 200 when session is not in CIC_SESSION_CREATED", async () => {
		const session = getMockSessionItem();
		mockCicService.getSessionById.mockResolvedValue({ ...session, authSessionState: AuthSessionState.CIC_ACCESS_TOKEN_ISSUED });

		const out: Response = await claimedIdRequestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(logger.info).toHaveBeenCalledWith('Duplicate request, returning status 200, sessionId: ', '1234')
	});

	it("Return 401 when session with that session id not found in the DB", async () => {
		mockCicService.getSessionById.mockResolvedValue(undefined);

		const out: Response = await claimedIdRequestProcessorTest.processRequest(VALID_CLAIMEDID, "1234");

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("No session found with the session id: 1234");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith("No session found for session id", {
			messageCode: MessageCodes.SESSION_NOT_FOUND,
		});
	});
});
