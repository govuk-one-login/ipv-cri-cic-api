import { CicService } from "../../../src/services/CicService";

import { GetItemInput, GetItemOutput, UpdateItemInput, UpdateItemOutput } from "aws-sdk/clients/dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { mock } from "jest-mock-extended";
import AWS from "aws-sdk";
import { StatusCodes } from "http-status-codes";
import { CicSession } from "../../../src/models/CicSession";
import { randomUUID } from "crypto";

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CIC",
});
let cicService: CicService;
const tableName = "MYTABLE";
const sessionId = "SESSID";
const SESSION_RECORD = require("../data/db_record.json");

const FAILURE_VALUE = "throw_me";

describe("Cic Service", () => {
	beforeEach(() => {
		jest.resetAllMocks();

		const documentClient = mock<AWS.DynamoDB.DocumentClient>({
			get: (params: GetItemInput) => {
				let promise;
				// @ts-ignore
				if (params.Key?.sessionId === FAILURE_VALUE) {
					promise = Promise.reject();
				} else if (params.Key?.sessionId === SESSION_RECORD.sessionId) {
					promise = Promise.resolve({
						Item: SESSION_RECORD,
					});
				} else {
					promise = Promise.resolve();
				}
				return mock<AWS.Request<GetItemOutput, AWS.AWSError>>({
					promise: jest.fn().mockReturnValue(promise),
				});
			},
			update: (params: UpdateItemInput) => {
				let promise;
				// @ts-ignore
				if (params.Key?.sessionId === FAILURE_VALUE) {
					promise = Promise.reject();
				} else if (params.Key?.sessionId === SESSION_RECORD.id) {
					promise = Promise.resolve({
						Attributes: SESSION_RECORD,
					});
				} else {
					promise = Promise.resolve();
				}
				return mock<AWS.Request<UpdateItemOutput, AWS.AWSError>>({
					promise: jest.fn().mockReturnValue(promise),
				});
			},
		});

		cicService = new CicService(tableName, logger);
		// @ts-expect-error
		cicService.dynamo = documentClient;
	});
	it("Should return a session item when passed a valid session Id", async () => {
		const result = await cicService.getSessionById(sessionId);
		console.log(result);
		expect(result).toEqual({ sessionId: "SESSID" });
	});

	it("Should not throw an error and return undefined when session doesn't exist", async () => {
		const result = await cicService.getSessionById("1234");
		console.log(result);
		expect(result).toBeUndefined();
	});

	it("should throw 500 if request fails", async () => {
		return expect(cicService.getSessionById(FAILURE_VALUE)).rejects.toThrow(expect.objectContaining({
			statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
		}));
	});

	it("Should not throw an error and return undefined when saving CIC data doesn't exist", async () => {
		const cicSess = new CicSession({ fullName: "Test", dateOfBirth: "1970-01-01", documentSelected: "passport", dateOfExpiry: "1970-01-01" });
		return expect(cicService.saveCICData("SESSID", cicSess)).resolves.toBeUndefined();
	});

	it("should throw 500 if request fails during save CIC data", async () => {
		const cicSess = new CicSession({ fullName: "Test", dateOfBirth: "1970-01-01", documentSelected: "passport", dateOfExpiry: "1970-01-01" });

		return expect(cicService.saveCICData(FAILURE_VALUE, cicSess)).rejects.toThrow(expect.objectContaining({
			statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
		}));
	});

	it("Should not throw an error and return undefined when set AuthorizationCode CIC data doesn't exist", async () => {
		return expect(cicService.setAuthorizationCode("SESSID", randomUUID())).resolves.toBeUndefined();
	});

	it("should throw 500 if request fails when setting AuthorizationCode", async () => {
		return expect(cicService.setAuthorizationCode(FAILURE_VALUE, randomUUID())).rejects.toThrow(expect.objectContaining({
			statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
		}));
	});
});
