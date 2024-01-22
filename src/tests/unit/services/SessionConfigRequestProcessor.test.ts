/* eslint-disable @typescript-eslint/unbound-method */
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { CicService } from "../../../services/CicService";
import { ISessionItem } from "../../../models/ISessionItem";
import { MessageCodes } from "../../../models/enums/MessageCodes";
import { Response } from "../../../utils/Response";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { SessionConfigRequestProcessor } from "../../../services/SessionConfigRequestProcessor";
import { AuthSessionState } from "../../../models/enums/AuthSessionState";
import { VALID_SESSIONCONFIG } from "../data/session-config-events";
import { Constants } from "../../../utils/Constants";

let sessionConfigRequestProcessorTest: SessionConfigRequestProcessor;
const mockCicService = mock<CicService>();

const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "CIC" });

function getMockSessionItem(): ISessionItem {
	const session: ISessionItem = {
		sessionId: "sdfsdg",
		clientId: "ipv-core-stub",
		accessToken: "AbCdEf123456",
		clientSessionId: "sdfssg",
		authorizationCode: "DEFAULTAUTHCODE",
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
		authSessionState: AuthSessionState.CIC_DATA_RECEIVED,
		journey: "Face-To-Face",
	};
	return session;
}

describe("SessionConfigRequestProcessor", () => {
	beforeAll(() => {
		sessionConfigRequestProcessorTest = new SessionConfigRequestProcessor(logger, metrics);
		// @ts-ignore
		sessionConfigRequestProcessorTest.cicService = mockCicService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("Return successful response with 200 OK with journey_type in response body", async () => {
		const session = getMockSessionItem();
		mockCicService.getSessionById.mockResolvedValue(session);

		const out: Response = await sessionConfigRequestProcessorTest.processRequest("sdfsdg");

		expect(out.body).toEqual(JSON.stringify({
			journey_type: session.journey,
		}));

		expect(logger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: session.clientSessionId });
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});

	it("Return successful response with 200 OK with default Face-To-Face journey_type when journey is not set for a session-id", async () => {
		const session = getMockSessionItem();
		delete session.journey;
		mockCicService.getSessionById.mockResolvedValue(session);

		const out: Response = await sessionConfigRequestProcessorTest.processRequest("sdfsdg");

		expect(out.body).toEqual(JSON.stringify({
			journey_type: Constants.FACE_TO_FACE_JOURNEY,
		}));

		expect(logger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: session.clientSessionId });
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
	});

	
	it("Return 401 when session with that session id not found in the DB", async () => {
		mockCicService.getSessionById.mockResolvedValue(undefined);

		const out: Response = await sessionConfigRequestProcessorTest.processRequest("invalid-session-id");

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("No session found with the session id: invalid-session-id");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith("No session found for session id", { messageCode: MessageCodes.SESSION_NOT_FOUND });
	});
	
});
