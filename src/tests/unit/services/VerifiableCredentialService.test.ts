import { UserInfoRequestProcessor } from "../../../services/UserInfoRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { CicService } from "../../../services/CicService";
import { Response } from "../../../utils/Response";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { ISessionItem } from "../../../models/ISessionItem";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import {
	MockKmsJwtAdapterForVc,
} from "../utils/MockJwtVerifierSigner";
import { VALID_VC } from "../data/verified_credential";
import { Constants } from "../../../utils/Constants";
import { VALID_USERINFO } from "../data/userInfo-events";

let userInforequestProcessorTest: UserInfoRequestProcessor;
const mockCicService = mock<CicService>();
let mockSession : ISessionItem;
const passingKmsJwtAdapterFactory = (_signingKeys: string) => new MockKmsJwtAdapterForVc(true);

const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "CIC" });

function getMockSessionItem() : ISessionItem {
	const sess: ISessionItem = {
		sessionId : "sdfsdg",
		clientId: "ipv-core-stub",
		accessToken: "AbCdEf123456",
		clientSessionId: "sdfssg",
		authorizationCode: "",
		authorizationCodeExpiryDate: 123,
		redirectUri: "http",
		accessTokenExpiryDate: 1234,
		expiryDate: 123,
		createdDate: 123,
		state: "initial",
		subject: "sub",
		persistentSessionId: "sdgsdg",
		clientIpAddress: "127.0.0.1",
		attemptCount: 1,
		given_names: ["FRED", "NICK"],
		family_names: ["OTHER", "NAME"],
		date_of_birth: "01-01-1960",
		document_selected: "brp",
		date_of_expiry: "23-04-2024",
		authSessionState: "CIC_ACCESS_TOKEN_ISSUED",
	};
	return sess;
}

describe("Issuing verified credentials", () => {
	beforeAll(() => {
		mockSession = getMockSessionItem();
		userInforequestProcessorTest = new UserInfoRequestProcessor(logger, metrics);
		// @ts-ignore
		userInforequestProcessorTest.cicService = mockCicService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		// @ts-ignore
		userInforequestProcessorTest.kmsJwtAdapter = passingKmsJwtAdapterFactory();
		mockSession = getMockSessionItem();
	});

	it("Return successful response with 200 OK when user data is found for an accessToken", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		const expectedJwt = VALID_VC;
		expectedJwt.iat = absoluteTimeNow();
		expectedJwt.nbf = absoluteTimeNow();
		expectedJwt.exp = expectedJwt.iat + Constants.CREDENTIAL_EXPIRY;
		// @ts-ignore
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(out.statusCode).toBe(HttpCodesEnum.OK);

		const actualJwt = JSON.parse(JSON.parse(out.body)["https://vocab.account.gov.uk/v1/credentialJWT"]);
		expect(actualJwt).toEqual(expectedJwt);
	});

	it.each([
		[["FRED", "NICK"], ["FAMILY"], 3],
		[["FRED"], ["FAMILY"], 2],
		[["FRED", "NICK"], ["FAMILY", "NAME"], 4],
		[["FRED", "NICK", "JAMES"], ["FAMILY", "NAME"], 5],
	])("Return successful response with 200 OK and verify length of name parts in the VC", async (givenName, familyName, expectedLength) => {
		// @ts-ignore
		mockSession.given_names = givenName;
		// @ts-ignore
		mockSession.family_names = familyName;
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		// @ts-ignore
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();

		const out: Response = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(out.statusCode).toBe(HttpCodesEnum.OK);

		const actualJwt = JSON.parse(JSON.parse(out.body)["https://vocab.account.gov.uk/v1/credentialJWT"]);
		const nameParts = actualJwt.vc.credentialSubject.name[0].nameParts;
		expect(nameParts).toHaveLength(expectedLength);
	});

});
