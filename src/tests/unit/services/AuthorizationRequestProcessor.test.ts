/* eslint-disable @typescript-eslint/unbound-method */
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { CicService } from "../../../services/CicService";
import { ISessionItem } from "../../../models/ISessionItem";
import { MessageCodes } from "../../../models/enums/MessageCodes";
import { Response } from "../../../utils/Response";
import { CicResponse } from "../../../utils/CicResponse";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { AuthSessionState } from "../../../models/enums/AuthSessionState";
import { AuthorizationRequestProcessor } from "../../../services/AuthorizationRequestProcessor";
import { VALID_AUTHCODE } from "../data/auth-events";

let authorizationRequestProcessorTest: AuthorizationRequestProcessor;
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
	};
	return session;
}

describe("AuthorizationRequestProcessor", () => {
	beforeAll(() => {
		authorizationRequestProcessorTest = new AuthorizationRequestProcessor(logger, metrics);
		// @ts-expect-error private access manipulation used for testing
		authorizationRequestProcessorTest.cicService = mockCicService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("Return successful response with 200 OK when auth code", async () => {
		const session = getMockSessionItem();
		mockCicService.getSessionById.mockResolvedValue(session);

		const out: Response = await authorizationRequestProcessorTest.processRequest(VALID_AUTHCODE, "1234");

		const cicResp = new CicResponse(JSON.parse(out.body));

		expect(out.body).toEqual(JSON.stringify({
			authorizationCode: {
				value: `${cicResp.authorizationCode.value}`,
			},
			redirect_uri: "http://localhost:8085/callback",
			state: "Y@atr",
		}));

		expect(mockCicService.setAuthorizationCode).toHaveBeenCalledTimes(1);
		expect(mockCicService.sendToTXMA).toHaveBeenCalledTimes(1);
		expect(logger.appendKeys).toHaveBeenCalledWith({ govuk_signin_journey_id: session.clientSessionId });
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
	});

	it.each(["CIC_AUTH_CODE_ISSUED", "CIC_ACCESS_TOKEN_ISSUED"])(
		"Returns authCode from DB if state is %s",
		async (authSessionState) => {
			const session = getMockSessionItem();
			session.authSessionState = authSessionState;
			mockCicService.getSessionById.mockResolvedValue(session);
	
			const out: Response = await authorizationRequestProcessorTest.processRequest(
				VALID_AUTHCODE,
				"1234",
			);
	
			expect(out.body).toEqual(
				JSON.stringify({
					authorizationCode: {
						value: "DEFAULTAUTHCODE",
					},
					redirect_uri: "http://localhost:8085/callback",
					state: "Y@atr",
				}),
			);
	
			expect(mockCicService.setAuthorizationCode).not.toHaveBeenCalled();
			expect(mockCicService.sendToTXMA).not.toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith(
				`Duplicate request for session in state: ${authSessionState}, returning authCode from DB`,
				"1234",
			);
			expect(out.statusCode).toBe(HttpCodesEnum.OK);
		},
	);
	

	it("Return 401 when session is in incorrect state", async () => {
		const session = getMockSessionItem();
		session.authSessionState = "CIC_SESSION_CREATED";
		mockCicService.getSessionById.mockResolvedValue(session);

		const out: Response = await authorizationRequestProcessorTest.processRequest(VALID_AUTHCODE, "1234");

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe(`Session is in the wrong state: ${session.authSessionState}`);
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith(
			`Session is in an unexpected state: ${session.authSessionState}, expected state should be ${AuthSessionState.CIC_DATA_RECEIVED}, ${AuthSessionState.CIC_AUTH_CODE_ISSUED} or ${AuthSessionState.CIC_ACCESS_TOKEN_ISSUED}`,
			{ messageCode: MessageCodes.INCORRECT_SESSION_STATE },
		);
	});

	it("Return 401 when session is in an unknown state", async () => {
		const session = getMockSessionItem();
		session.authSessionState = "UNKNOWN";
		mockCicService.getSessionById.mockResolvedValue(session);

		const out: Response = await authorizationRequestProcessorTest.processRequest(VALID_AUTHCODE, "1234");

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe(`Session is in the wrong state: ${session.authSessionState}`);
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith(
			`Session is in an unexpected state: UNKNOWN, expected state should be ${AuthSessionState.CIC_DATA_RECEIVED}, ${AuthSessionState.CIC_AUTH_CODE_ISSUED} or ${AuthSessionState.CIC_ACCESS_TOKEN_ISSUED}`,
			{ messageCode: MessageCodes.INCORRECT_SESSION_STATE },
		);
	});

	it("Return 401 when session is expired", async () => {
		const session = getMockSessionItem();
		session.expiryDate = 1675458564;
		mockCicService.getSessionById.mockResolvedValue(session);

		const out: Response = await authorizationRequestProcessorTest.processRequest(VALID_AUTHCODE, "1234");

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("Session with session id: 1234 has expired");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith("Session has expired", { messageCode: MessageCodes.EXPIRED_SESSION });
	});

	it("Return 401 when session with that session id not found in the DB", async () => {
		mockCicService.getSessionById.mockResolvedValue(undefined);

		const out: Response = await authorizationRequestProcessorTest.processRequest(VALID_AUTHCODE, "1234");

		expect(mockCicService.getSessionById).toHaveBeenCalledTimes(1);
		expect(out.body).toBe("No session found with the session id: 1234");
		expect(out.statusCode).toBe(HttpCodesEnum.UNAUTHORIZED);
		expect(logger.error).toHaveBeenCalledWith("No session found for session id", { messageCode: MessageCodes.SESSION_NOT_FOUND });
	});

	it("Return 200 when write to txMA fails", async () => {
		const session = getMockSessionItem();
		mockCicService.getSessionById.mockResolvedValue(session);
		mockCicService.sendToTXMA.mockRejectedValue({});

		const out: Response = await authorizationRequestProcessorTest.processRequest(VALID_AUTHCODE, "1234");

		const cicResp = new CicResponse(JSON.parse(out.body));

		expect(out.body).toEqual(JSON.stringify({
			authorizationCode: {
				value: `${cicResp.authorizationCode.value}`,
			},
			redirect_uri: "http://localhost:8085/callback",
			state: "Y@atr",
		}));

		expect(mockCicService.setAuthorizationCode).toHaveBeenCalledTimes(1);
		expect(mockCicService.sendToTXMA).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith("Failed to write TXMA event CIC_CRI_AUTH_CODE_ISSUED to SQS queue.", { error: {}, messageCode: MessageCodes.ERROR_WRITING_TXMA });
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(logger.appendKeys).toHaveBeenCalledWith({
			govuk_signin_journey_id: "sdfssg",
		});
	});
});
