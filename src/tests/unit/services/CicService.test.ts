 
import { CicService } from "../../../services/CicService";
import { Logger } from "@aws-lambda-powertools/logger";
import { CicSession } from "../../../models/CicSession";
import { randomUUID } from "crypto";
import { createDynamoDbClient } from "../../../utils/DynamoDBFactory";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";

let cicService: CicService;
const tableName = "MYTABLE";
const sessionId = "SESSID";
const expiryDate = 9999999999999;
const mockDynamoDbClient = jest.mocked(createDynamoDbClient());
import SESSION_RECORD from "../data/db_record.json";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { TxmaEvent } from "../../../utils/TxmaEvent";
import { TxmaEventNames } from "../../../models/enums/TxmaEvents";
import { mock } from "jest-mock-extended";
import { ISessionItem } from "../../../models/ISessionItem";
import { Constants } from "../../../utils/Constants";
import { AppError } from "../../../utils/AppError";

const FAILURE_VALUE = "throw_me";

const getTXMAEventPayload = (): TxmaEvent => ({
	event_name: TxmaEventNames.CIC_CRI_START,
	user: {
		user_id: "sessionCliendId",
		persistent_session_id: "sessionPersistentSessionId",
		session_id: "sessionID",
		govuk_signin_journey_id: "clientSessionId",
		ip_address: "sourceIp",
		transaction_id: ""
	},
	timestamp: 123,
	event_timestamp_ms: 123000,
	component_id: "issuer",
});

const logger = mock<Logger>();

jest.mock('@aws-sdk/client-sqs', () => ({
    SQSClient: jest.fn(),
    SendMessageCommand: jest.fn(),
}));

describe("Cic Service", () => {

	let mockSend: jest.Mock;
	let txmaEventPayload: TxmaEvent;

	beforeEach(() => {
		jest.resetAllMocks();
		txmaEventPayload = getTXMAEventPayload();
		cicService = new CicService(tableName, logger, mockDynamoDbClient);
		mockSend = jest.fn();
		(SQSClient as jest.Mock).mockImplementation(() => ({
			send: mockSend,
		}));

	});
	it("Should return a session item when passed a valid session Id", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item: SESSION_RECORD });
		const result = await cicService.getSessionById(sessionId);
		expect(result).toEqual({ sessionId: "SESSID" });
	});

	it("Should not throw an error and return undefined when session doesn't exist", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
		expect(cicService.getSessionById("1234")).resolves.toBeUndefined();
	});

	it("Should not throw an AppError when Dynamo errors", async () => {
		mockDynamoDbClient.send = jest.fn().mockImplementation(() => {
	 		throw new AppError(HttpCodesEnum.SERVER_ERROR, "getItem - failed: got error getting session");
	 	});
		await expect(cicService.getSessionById("1234")).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session")
		);
	});

	it("Should return a person item when passed a valid session Id", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item: SESSION_RECORD });
		const result = await cicService.getPersonIdentityBySessionId(sessionId);
		expect(result).toEqual({ sessionId: "SESSID" });
	});

	it("Should not throw an error and return undefined when person doesn't exist", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
		expect(cicService.getPersonIdentityBySessionId("1234")).resolves.toBeUndefined();
	});

	it("Should not throw an AppError when Dynamo errors gettting person details", async () => {
		mockDynamoDbClient.send = jest.fn().mockImplementation(() => {
	 		throw new AppError(HttpCodesEnum.SERVER_ERROR, "getItem - failed: got error getting session");
	 	});
		await expect(cicService.getPersonIdentityBySessionId("1234")).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, "Error retrieving Session")
		);
	});

	it("Should not throw an error and return undefined when session expiry date has passed", async () => {
		const expiredSession = {
			...SESSION_RECORD,
			expiryDate: absoluteTimeNow() - 500,
		};
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({ Item: expiredSession });
		await expect(cicService.getSessionById("1234")).rejects.toThrow("Session with session id: 1234 has expired");
	});

	it("should throw 500 if request fails during save CIC data", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		const cicSess = new CicSession({ given_names: ["Test", "user"], family_names: "Family name", date_of_birth: "1970-01-01" });

		await expect(cicService.saveCICData(FAILURE_VALUE, cicSess, expiryDate)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});

	it("should throw 500 if request fails during save Auth state data", async () => {
		mockDynamoDbClient.send = jest.fn().mockReturnValueOnce({}).mockImplementation(() => {
	 		throw new AppError(HttpCodesEnum.SERVER_ERROR, "getItem - failed: got error getting session");
	 	});
		const cicSess = new CicSession({ given_names: ["Test", "user"], family_names: "Family name", date_of_birth: "1970-01-01" });

		await expect(cicService.saveCICData(FAILURE_VALUE, cicSess, expiryDate)).rejects.toThrow(expect.objectContaining({
			message: "Failed to set claimed identity data ",
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});


	it("should resolve if given_names and family_names correctly provided in CicSession", async () => {
		mockDynamoDbClient.send = jest.fn().mockResolvedValue({});
		const cicSess = new CicSession({ given_names: ["Geralt", "Rivia"], family_names: "Maximus Dec'mus", date_of_birth: "1970-01-01" });

		expect(cicService.saveCICData("1234", cicSess, expiryDate)).resolves.not.toThrow();
	});

	it("should throw bad request if given_name has a symbol in CicSession", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		const cicSess = new CicSession({ given_names: ["Ger#lt", "Ri%ia"], family_names: "Family name", date_of_birth: "1970-01-01" });

		await expect(cicService.saveCICData(FAILURE_VALUE, cicSess, expiryDate)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.BAD_REQUEST,
		}));
	});

	it("should throw bad request error if given_name has a space in CicSession", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		const cicSess = new CicSession({ given_names: ["Cairne ", " Bloodhoof "], family_names: "Hammerfell", date_of_birth: "1970-01-01" });

		await expect(cicService.saveCICData(FAILURE_VALUE, cicSess, expiryDate)).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.BAD_REQUEST,
		}));
	});

	it("Should not throw an error and return undefined when set AuthorizationCode CIC data doesn't exist", async () => {
		expect(cicService.setAuthorizationCode("SESSID", randomUUID())).resolves.toBeUndefined();
	});

	it("should throw 500 if request fails when setting AuthorizationCode", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});
		await expect(cicService.setAuthorizationCode(FAILURE_VALUE, randomUUID())).rejects.toThrow(expect.objectContaining({
			statusCode: HttpCodesEnum.SERVER_ERROR,
		}));
	});

	it("should throw 500 if request fails during update Session data with access token details", async () => {
		mockDynamoDbClient.send = jest.fn().mockRejectedValue({});

		await expect(cicService.updateSessionWithAccessTokenDetails("SESSID", 12345)).rejects.toThrow(expect.objectContaining({
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

	describe("#sendToTXMA", () => {
		it("Should send event to TxMA without encodedHeader if encodedHeader param is missing", async () => {  
			const payload = txmaEventPayload;
			await cicService.sendToTXMA(payload);
	
			const messageBody = JSON.stringify(payload);			
	
			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: "TXMA_QUEUE_URL",
			});
			expect(logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});

		it("Should send event to TxMA without encodedHeader if encodedHeader param is empty", async () => {  
			const payload = txmaEventPayload;
			await cicService.sendToTXMA(payload, "");
	
			const messageBody = JSON.stringify(payload);			
	
			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: "TXMA_QUEUE_URL",
			});
			expect(logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});

		it("Should send event to TxMA with the correct details for a payload without restricted present", async () => {  
			await cicService.sendToTXMA(txmaEventPayload, "ENCHEADER");
	
			const messageBody = JSON.stringify({
				...txmaEventPayload,
				restricted: {
					device_information: {
						encoded: "ENCHEADER",
					},
				},
			});
	
			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: "TXMA_QUEUE_URL",
			});
			expect(logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});

		it("Should send event to TxMA with the correct details for a payload with restricted present", async () => {  
				
			const restrictedDetails = {
				device_information: {
					encoded: "ENCHEADER",
				},
			};
	
			const payload = txmaEventPayload;
			payload.restricted = restrictedDetails;
	
			await cicService.sendToTXMA(payload, "ENCHEADER");
			const messageBody = JSON.stringify(payload);
	
			expect(SendMessageCommand).toHaveBeenCalledWith({
				MessageBody: messageBody,
				QueueUrl: "TXMA_QUEUE_URL",
			});
			expect(logger.info).toHaveBeenCalledWith("Sent message to TxMA");
		});		

		it("show throw error if failed to send to TXMA queue", async () => {
			mockSend.mockRejectedValueOnce("Simulated SQS error");

			await expect(cicService.sendToTXMA(txmaEventPayload)).rejects.toThrow(expect.objectContaining({
				statusCode: HttpCodesEnum.SERVER_ERROR,
			}));
			expect(logger.error).toHaveBeenCalledWith({
				message: "Error when sending message to TXMA Queue", error : "Simulated SQS error",
			});
		});
	});

	describe('getSessionByAuthorizationCode', () => {

		it('should successfully retrieve a session by authorization code', async () => {
			const mockSessionItem: ISessionItem = {
				sessionId: 'testSessionId',
				authorizationCode: 'testAuthorizationCode',
				expiryDate: (Date.now() / 1000) + +3600000,
				clientId: "clientId",
				clientSessionId: "govuk-journey-signid",
				redirectUri: "http://localhost",
				createdDate: 1000,
				state: "set",
				subject: "urn-12346",
				persistentSessionId: "1234567890",
				clientIpAddress: "192.0.0.0",
				attemptCount: 0,
				authSessionState: ""
			};

			mockDynamoDbClient.query = jest.fn().mockResolvedValue({ Items: [mockSessionItem] });

			const session = await cicService.getSessionByAuthorizationCode('testAuthorizationCode');

			expect(session).toEqual(mockSessionItem);
			expect(mockDynamoDbClient.query).toHaveBeenCalledWith({
				TableName: 'MYTABLE',
				IndexName: Constants.AUTHORIZATION_CODE_INDEX_NAME,
				KeyConditionExpression: 'authorizationCode = :authorizationCode',
				ExpressionAttributeValues: { ':authorizationCode': 'testAuthorizationCode' },
			});
		});

		it('should throw an error if no session is found', async () => {
			mockDynamoDbClient.query = jest.fn().mockResolvedValue({ Items: [] });

			await expect(cicService.getSessionByAuthorizationCode('testAuthorizationCode')).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, 'Error retrieving Session by authorization code')
			);
		});

		it('should throw an error if multiple sessions are found', async () => {
			mockDynamoDbClient.query = jest.fn().mockResolvedValue({ Items: [{}, {}] });

			await expect(cicService.getSessionByAuthorizationCode('testAuthorizationCode')).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, 'Error retrieving Session by authorization code')
			);
		});

		it('should throw an error if the session has expired', async () => {
			const mockSessionItem: ISessionItem = {
				sessionId: 'testSessionId',
				authorizationCode: 'testAuthorizationCode',
				expiryDate: (Date.now() / 1000) - 3600000,
				clientId: "clientId",
				clientSessionId: "govuk-journey-signid",
				redirectUri: "http://localhost",
				createdDate: 1000,
				state: "set",
				subject: "urn-12346",
				persistentSessionId: "1234567890",
				clientIpAddress: "192.0.0.0",
				attemptCount: 0,
				authSessionState: ""
			}
			mockDynamoDbClient.query = jest.fn().mockResolvedValue({ Items: [mockSessionItem] });

			await expect(cicService.getSessionByAuthorizationCode('testAuthorizationCode')).rejects.toThrow(
			new AppError(HttpCodesEnum.UNAUTHORIZED, `Session with session id: testSessionId has expired`)
			);
		});

		it('should handle undefined authorization code', async () => {
			mockDynamoDbClient.query = jest.fn().mockResolvedValue({ Items: [] });
			await expect(cicService.getSessionByAuthorizationCode(undefined)).rejects.toThrow(
			new AppError(HttpCodesEnum.SERVER_ERROR, 'Error retrieving Session by authorization code')
			);
		});

		it('should handle DynamoDB query error', async () => {
			mockDynamoDbClient.query = jest.fn().mockRejectedValue(new Error('DynamoDB query failed'));

			await expect(cicService.getSessionByAuthorizationCode('testAuthorizationCode')).rejects.toThrow('DynamoDB query failed');
		});
	});

	describe("createAuthSession", () => {
		let tableName: string;
		const mockSessionItem: ISessionItem = {
			sessionId: 'testSessionId',
			authorizationCode: 'testAuthorizationCode',
			expiryDate: (Date.now() / 1000) + +3600000,
			clientId: "clientId",
			clientSessionId: "govuk-journey-signid",
			redirectUri: "http://localhost",
			createdDate: 1000,
			state: "set",
			subject: "urn-12346",
			persistentSessionId: "1234567890",
			clientIpAddress: "192.0.0.0",
			attemptCount: 0,
			authSessionState: ""
		};

		beforeEach(() => {
			tableName = "MYTABLE";
		});

		it("should successfully create a session", async () => {
			await cicService.createAuthSession(mockSessionItem);

			expect(mockDynamoDbClient.send).toHaveBeenCalledWith(expect.objectContaining({
				input: {
					Item: mockSessionItem,
					TableName: tableName
				},
			}));
			expect(logger.info).toHaveBeenCalledWith({ message: "Saving session data in DynamoDB", tableName });
			expect(logger.info).toHaveBeenCalledWith("Successfully created session in dynamodb");
			expect(logger.error).not.toHaveBeenCalled();
		});

		it("should handle errors during session creation", async () => {

			const mockError = new Error("createItem - failed: got error creating session");
			mockDynamoDbClient.send = jest.fn().mockImplementation(() => {
	 			throw new AppError(HttpCodesEnum.SERVER_ERROR, "createItem - failed: got error creating session");
	 		});

			await expect(cicService.createAuthSession(mockSessionItem)).rejects.toThrow(expect.objectContaining({
						statusCode: HttpCodesEnum.SERVER_ERROR,
			}));
			expect(mockDynamoDbClient.send).toHaveBeenCalledWith(expect.objectContaining({
				input: {
					Item: mockSessionItem,
					TableName: tableName
				},
			}));
			expect(logger.info).toHaveBeenCalledWith({ message: "Saving session data in DynamoDB", tableName });
			expect(logger.error).toHaveBeenCalledWith("got error " + mockError);
		});
	});
});
