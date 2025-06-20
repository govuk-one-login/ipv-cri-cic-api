import { UserInfoRequestProcessor } from "../../../services/UserInfoRequestProcessor";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";
import { CicService } from "../../../services/CicService";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { ISessionItem } from "../../../models/ISessionItem";
import { PersonIdentityItem } from "../../../models/PersonIdentityItem";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import {
	MockKmsJwtAdapterForVc,
} from "../utils/MockJwtVerifierSigner";
import { VALID_VC } from "../data/verified_credential";
import { VALID_USERINFO } from "../data/userInfo-events";
import { ValidationHelper } from "../../../utils/ValidationHelper";
import { APIGatewayProxyResult } from "aws-lambda";

let userInforequestProcessorTest: UserInfoRequestProcessor;
const mockCicService = mock<CicService>();
let mockSession: ISessionItem;
let mockPerson: PersonIdentityItem;
const passingKmsJwtAdapterFactory = () => new MockKmsJwtAdapterForVc(true);

const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "CIC" });

function getMockSessionItem(): ISessionItem {
	const sess: ISessionItem = {
		sessionId: "sdfsdg",
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
		authSessionState: "CIC_ACCESS_TOKEN_ISSUED",
	};
	return sess;
}

function getMockPersonItem(): PersonIdentityItem {
	const person: PersonIdentityItem = {
		sessionId: "sdfsdg",
		addresses: [{
			uprn: 100,
			organisationName: "string",
			departmentName: "string",
			subBuildingName: "string",
			buildingNumber: "string",
			buildingName: "string",
			dependentStreetName: "string",
			streetName: "string",
			doubleDependentAddressLocality: "string",
			dependentAddressLocality: "string",
			addressLocality: "string",
			postalCode: "string",
			addressCountry: "string",
			validFrom: "string",
			validUntil: "string",
		}],
		personNames: [{
			nameParts: [
				{ type: "GivenName", value: "FRED" },
				{ type: "GivenName", value: "NICK" },
				{ type: "FamilyName", value: "OTHER" },
				{ type: "FamilyName", value: "NAME" }],
		}],
		birthDates: [{ value: "01-01-1960" }],
		expiryDate: 123,

	};
	return person;
}

describe("Issuing verified credentials", () => {
	beforeAll(() => {
		mockSession = getMockSessionItem();
		mockPerson = getMockPersonItem();
		userInforequestProcessorTest = new UserInfoRequestProcessor(logger, metrics);
		// @ts-expect-error private access manipulation used for testing
		userInforequestProcessorTest.cicService = mockCicService;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		// @ts-expect-error private access manipulation used for testing
		userInforequestProcessorTest.kmsJwtAdapter = passingKmsJwtAdapterFactory();
		mockSession = getMockSessionItem();
		mockPerson = getMockPersonItem();
	});

	it("Return successful response with 200 OK when user data is found for an accessToken", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(mockPerson);

		const expectedJwt = VALID_VC;
		expectedJwt.iat = absoluteTimeNow();
		expectedJwt.nbf = absoluteTimeNow();
		// @ts-expect-error private access manipulation used for testing
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();

		const out: APIGatewayProxyResult = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		const actualJwt = JSON.parse(JSON.parse(out.body)["https://vocab.account.gov.uk/v1/credentialJWT"]);
		//Setting the actualJwt jti to mock value to pass test
		actualJwt.jti = "uuid";
		expect(actualJwt).toEqual(expectedJwt);
	});

	it("Verify jti claim in the generated VC is a valid UUID", async () => {
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(mockPerson);

		// @ts-expect-error private access manipulation used for testing
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();

		const out: APIGatewayProxyResult = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(out.statusCode).toBe(HttpCodesEnum.OK);
		const actualJwt = JSON.parse(JSON.parse(out.body)["https://vocab.account.gov.uk/v1/credentialJWT"]);
		expect(new ValidationHelper().isValidUUID(actualJwt.jti)).toBeTruthy();
	});

	it.each([
		[[
			{ type: "FamilyName", value: "OTHER" },
			{ type: "FamilyName", value: "NAME" }], 2],
		[[
			{ type: "GivenName", value: "FRED" },
			{ type: "GivenName", value: "NICK" },
			{ type: "FamilyName", value: "OTHER" },
			{ type: "FamilyName", value: "NAME" }], 4],
		[[
			{ type: "GivenName", value: "FRED" },
			{ type: "GivenName", value: "NICK" },
			{ type: "FamilyName", value: "OTHER" }], 3],
	])("Return successful response with 200 OK and verify length of name parts in the VC", async (personName, expectedLength) => {
		mockPerson.personNames[0].nameParts = personName;
		mockCicService.getSessionById.mockResolvedValue(mockSession);
		mockCicService.getPersonIdentityBySessionId.mockResolvedValue(mockPerson);

		// @ts-expect-error private access manipulation used for testing
		userInforequestProcessorTest.verifiableCredentialService.kmsJwtAdapter = passingKmsJwtAdapterFactory();

		const out: APIGatewayProxyResult = await userInforequestProcessorTest.processRequest(VALID_USERINFO);
		expect(out.statusCode).toBe(HttpCodesEnum.OK);

		const actualJwt = JSON.parse(JSON.parse(out.body)["https://vocab.account.gov.uk/v1/credentialJWT"]);
		const nameParts = actualJwt.vc.credentialSubject.name[0].nameParts;
		expect(nameParts).toHaveLength(expectedLength);
	});

});
