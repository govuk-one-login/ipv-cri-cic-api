import { mock } from "jest-mock-extended";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { AbortRequestProcessor } from "../../../services/AbortRequestProcessor";
import { CicService } from "../../../services/CicService";
import { ISessionItem } from "../../../models/ISessionItem";
import { MessageCodes } from "../../../models/enums/MessageCodes";
import { AuthSessionState } from "../../../models/enums/AuthSessionState";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { TxmaEventNames } from "../../../models/enums/TxmaEvents";
import { APIGatewayProxyResult } from "aws-lambda";

const mockCicService = mock<CicService>();
const logger = mock<Logger>();

let abortRequestProcessor: AbortRequestProcessor;
let cicSessionItem: ISessionItem;
const metrics = mock<Metrics>();
const sessionId = "RandomCICSessionID";
const encodedHeader = "ENCHEADER";
function getMockSessionItem(): ISessionItem {
	const sessionInfo: ISessionItem = {
		sessionId,
		clientId: "ipv-core-stub",
		// pragma: allowlist nextline secret
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
	return sessionInfo;
}

describe("AbortRequestProcessor", () => {
	beforeAll(() => {
		abortRequestProcessor = new AbortRequestProcessor(logger, metrics);
    		// @ts-expect-error linting to be updated
		abortRequestProcessor.cicService = mockCicService;
		cicSessionItem = getMockSessionItem();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("throws error if session cannot be found", async () => {
		mockCicService.getSessionById.mockResolvedValueOnce(undefined);

		await expect(abortRequestProcessor.processRequest(sessionId, encodedHeader)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.BAD_REQUEST,
			message: "Missing details in SESSION table",
		}));
		 
		expect(logger.error).toHaveBeenCalledWith("Missing details in SESSION TABLE", {
			messageCode: MessageCodes.SESSION_NOT_FOUND,
		});
	});

	it("returns successful response if session has already been aborted", async () => {
		mockCicService.getSessionById.mockResolvedValueOnce({ ...cicSessionItem, authSessionState: AuthSessionState.CIC_CRI_SESSION_ABORTED });

		const out: APIGatewayProxyResult = await abortRequestProcessor.processRequest(sessionId, encodedHeader);

		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(out.body).toBe("Session has already been aborted");
		 
		expect(logger.info).toHaveBeenCalledWith("Session has already been aborted");
		expect(metrics.addMetric).not.toHaveBeenCalled();
	});

	it("updates auth session state and returns successful response if session has not been aborted", async () => {
		mockCicService.getSessionById.mockResolvedValueOnce(cicSessionItem);

		const out: APIGatewayProxyResult = await abortRequestProcessor.processRequest(sessionId, encodedHeader);

		 
		expect(mockCicService.updateSessionAuthState).toHaveBeenCalledWith(sessionId, AuthSessionState.CIC_CRI_SESSION_ABORTED);
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(out.body).toBe("Session has been aborted");
		expect(out.headers?.Location).toBe(encodeURIComponent(`${cicSessionItem.redirectUri}?error=access_denied&state=${cicSessionItem.state}`));
		expect(metrics.addMetric).toHaveBeenCalledWith("state-CIC_CRI_SESSION_ABORTED", MetricUnits.Count, 1)
	});

	it("Returns successful response if session has not been aborted and redirectUri contains cic id", async () => {
		const cicSessionItemClone = cicSessionItem;
		cicSessionItemClone.redirectUri = "http://localhost:8085/callback?id=cic";
		mockCicService.getSessionById.mockResolvedValueOnce(cicSessionItem);

		const out: APIGatewayProxyResult = await abortRequestProcessor.processRequest(sessionId, encodedHeader);

		 
		expect(mockCicService.updateSessionAuthState).toHaveBeenCalledWith(sessionId, AuthSessionState.CIC_CRI_SESSION_ABORTED);
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(out.body).toBe("Session has been aborted");
		expect(out.headers?.Location).toContain(encodeURIComponent(`${cicSessionItem.redirectUri}&error=access_denied&state=${cicSessionItem.state}`));
		expect(metrics.addMetric).toHaveBeenCalledWith("state-CIC_CRI_SESSION_ABORTED", MetricUnits.Count, 1)
	});

	it("sends TxMA event after auth session state has been updated", async () => {
		mockCicService.getSessionById.mockResolvedValueOnce(cicSessionItem);

		await abortRequestProcessor.processRequest(sessionId, encodedHeader);

		 
		expect(mockCicService.sendToTXMA).toHaveBeenCalledWith(expect.objectContaining({
			event_name: TxmaEventNames.CIC_CRI_SESSION_ABORTED,
		}), encodedHeader);
		expect(metrics.addMetric).toHaveBeenCalledWith("state-CIC_CRI_SESSION_ABORTED", MetricUnits.Count, 1)
	});

	it("logs error if sending TxMA event fails, but successful response is still returned", async () => {
		mockCicService.getSessionById.mockResolvedValueOnce(cicSessionItem);
		mockCicService.sendToTXMA.mockRejectedValueOnce({});

		const out: APIGatewayProxyResult = await abortRequestProcessor.processRequest(sessionId, encodedHeader);

		 
		expect(logger.error).toHaveBeenCalledWith("Auth session successfully aborted. Failed to send CIC_CRI_SESSION_ABORTED event to TXMA", {
  			error: {},
  			messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
		});
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		expect(out.body).toBe("Session has been aborted");
		expect(metrics.addMetric).toHaveBeenCalledWith("state-CIC_CRI_SESSION_ABORTED", MetricUnits.Count, 1)
	});

	it("returns failed response if auth session state cannot be updated", async () => {
		mockCicService.getSessionById.mockResolvedValueOnce(cicSessionItem);
		mockCicService.updateSessionAuthState.mockRejectedValueOnce("Error updating auth session state");

		const out: APIGatewayProxyResult = await abortRequestProcessor.processRequest(sessionId, encodedHeader);

		expect(out.statusCode).toBe(HttpCodesEnum.SERVER_ERROR);
		expect(out.body).toBe("An error has occurred");
		expect(metrics.addMetric).not.toHaveBeenCalled();
	});
});
