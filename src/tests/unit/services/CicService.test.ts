/* eslint-disable max-lines-per-function */
import { CicService } from "../../../services/CicService";
import { Logger } from "@aws-lambda-powertools/logger";
import { CicSession } from "../../../models/CicSession";
import { randomUUID } from "crypto";
import { createDynamoDbClient } from "../../../utils/DynamoDBFactory";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CIC",
});

let cicService: CicService;
const tableName = "MYTABLE";
const sessionId = "SESSID";
const expiryDate = 9999999999999;
const mockDynamoDbClient = jest.mocked(createDynamoDbClient());
import SESSION_RECORD from "../data/db_record.json";

const FAILURE_VALUE = "throw_me";

describe("Cic Service", () => {
	beforeEach(() => {
		jest.resetAllMocks();
		cicService = new CicService(tableName, logger, mockDynamoDbClient);

	});
	it("Should return a session item when passed a valid session Id", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item: SESSION_RECORD });
		const result = await cicService.getSessionById(sessionId);
		expect(result).toEqual({ sessionId: "SESSID" });
	});

	it("Should not throw an error and return undefined when session doesn't exist", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
		return expect(cicService.getSessionById("1234")).resolves.toBeUndefined();
	});

	it("Should return a person item when passed a valid session Id", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item: SESSION_RECORD });
		const result = await cicService.getPersonIdentityBySessionId(sessionId);
		expect(result).toEqual({ sessionId: "SESSID" });
	});

	it("Should not throw an error and return undefined when person doesn't exist", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
		return expect(cicService.getPersonIdentityBySessionId("1234")).resolves.toBeUndefined();
	});

	it("Should not throw an error and return undefined when session expiry date has passed", async () => {
		const expiredSession = {
			...SESSION_RECORD,
			expiryDate: absoluteTimeNow() - 500,
		};
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item: expiredSession });
		return expect(cicService.getSessionById("1234")).rejects.toThrow("Session with session id: 1234 has expired");
	});

	it("should throw 500 if request fails during save CIC data", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		const cicSess = new CicSession({ given_names: ["Test", "user"], family_names: "Family name", date_of_birth: "1970-01-01" });

		return expect(cicService.saveCICData(FAILURE_VALUE, cicSess, expiryDate)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});


	it("should resolve if given_names and family_names correctly provided in CicSession", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
		const cicSess = new CicSession({ given_names: ["Geralt", "Rivia"], family_names: "Maximus Dec'mus", date_of_birth: "1970-01-01" });

		return expect(cicService.saveCICData("1234", cicSess, expiryDate)).resolves.not.toThrow();
	});

	it("should throw bad request if given_name has a symbol in CicSession", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		const cicSess = new CicSession({ given_names: ["Ger#lt", "Ri%ia"], family_names: "Family name", date_of_birth: "1970-01-01" });

		return expect(cicService.saveCICData(FAILURE_VALUE, cicSess, expiryDate)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.BAD_REQUEST,
		}));
	});

	it("should throw bad request error if given_name has a space in CicSession", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		const cicSess = new CicSession({ given_names: ["Cairne ", " Bloodhoof "], family_names: "Hammerfell", date_of_birth: "1970-01-01" });

		return expect(cicService.saveCICData(FAILURE_VALUE, cicSess, expiryDate)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.BAD_REQUEST,
		}));
	});

	it("Should not throw an error and return undefined when set AuthorizationCode CIC data doesn't exist", async () => {
		return expect(cicService.setAuthorizationCode("SESSID", randomUUID())).resolves.toBeUndefined();
	});

	it("should throw 500 if request fails when setting AuthorizationCode", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		return expect(cicService.setAuthorizationCode(FAILURE_VALUE, randomUUID())).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});

	it("should throw 500 if request fails during update Session data with access token details", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});

		return expect(cicService.updateSessionWithAccessTokenDetails("SESSID", 12345)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});

	describe("obfuscateJSONValues", () => {
		it("should obfuscate all fields except those in txmaFieldsToShow", async () => {
			const inputObject = {
				field1: "sensitive1",
				field2: "sensitive2",
				field3: "non-sensitive",
				nested: {
					field4: "sensitive3",
					field5: "non-sensitive",
					field6: null,
					field7: undefined,
				},
			};
	
			const txmaFieldsToShow = ["field3", "field5"];
	
			const obfuscatedObject = await cicService.obfuscateJSONValues(inputObject, txmaFieldsToShow);
	
			// Check that sensitive fields are obfuscated and non-sensitive fields are not
			expect(obfuscatedObject.field1).toBe("***");
			expect(obfuscatedObject.field2).toBe("***");
			expect(obfuscatedObject.field3).toBe("non-sensitive");
			expect(obfuscatedObject.nested.field4).toBe("***");
			expect(obfuscatedObject.nested.field5).toBe("non-sensitive");
			expect(obfuscatedObject.nested.field6).toBeNull();
			expect(obfuscatedObject.nested.field7).toBeUndefined();
		});
	
		it("should handle arrays correctly", async () => {
			const inputObject = {
				field1: "sensitive1",
				arrayField: [
					{
						field2: "sensitive2",
						field3: "non-sensitive",
					},
					{
						field2: "sensitive3",
						field3: "non-sensitive",
					},
				],
			};
	
			const txmaFieldsToShow = ["field3"];
	
			const obfuscatedObject = await cicService.obfuscateJSONValues(inputObject, txmaFieldsToShow);
	
			// Check that sensitive fields are obfuscated and non-sensitive fields are not
			expect(obfuscatedObject.field1).toBe("***");
			expect(obfuscatedObject.arrayField[0].field2).toBe("***");
			expect(obfuscatedObject.arrayField[0].field3).toBe("non-sensitive");
			expect(obfuscatedObject.arrayField[1].field2).toBe("***");
			expect(obfuscatedObject.arrayField[1].field3).toBe("non-sensitive");
		});
	
		it("should obfuscate values of different types", async () => {
			const inputObject = {
				stringField: "sensitive-string",
				numberField: 42,
				booleanField: true,
			};
	
			const txmaFieldsToShow: string[] | undefined = [];
	
			const obfuscatedObject = await cicService.obfuscateJSONValues(inputObject, txmaFieldsToShow);
	
			// Check that all fields are obfuscated
			expect(obfuscatedObject.stringField).toBe("***");
			expect(obfuscatedObject.numberField).toBe("***");
			expect(obfuscatedObject.booleanField).toBe("***");
		});
	
		it('should return "***" for non-object input', async () => {
			const input = "string-input";
	
			const obfuscatedValue = await cicService.obfuscateJSONValues(input);
	
			// Check that non-object input is obfuscated as '***'
			expect(obfuscatedValue).toBe("***");
		});
	});
});
