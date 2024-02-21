/* eslint-disable max-lines-per-function */
/* eslint-disable no-console */
import { CicSession } from "../models/CicSession";
import { ISessionItem } from "../models/ISessionItem";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import {
	DynamoDBDocument,
	GetCommand,
	QueryCommandInput,
	UpdateCommand,
	PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { getAuthorizationCodeExpirationEpoch, absoluteTimeNow } from "../utils/DateTimeUtils";
import { Constants } from "../utils/Constants";
import { AuthSessionState } from "../models/enums/AuthSessionState";
import { createSqsClient, SendMessageCommand } from "../utils/SqsClient";
import { TxmaEvent } from "../utils/TxmaEvent";
import {
	SharedClaimsItem,
	PersonIdentityDateOfBirth,
	PersonIdentityItem,
	PersonIdentityNamePart,
	PersonIdentityName,
} from "../models/PersonIdentityItem";
import { MessageCodes } from "../models/enums/MessageCodes";

export class CicService {
	readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

	readonly logger: Logger;

	private static instance: CicService;

	constructor(
		tableName: any,
		logger: Logger,
		dynamoDbClient: DynamoDBDocument,
	) {
		this.tableName = tableName;
		this.dynamo = dynamoDbClient;
		this.logger = logger;
	}

	static getInstance(
		tableName: string,
		logger: Logger,
		dynamoDbClient: DynamoDBDocument,
	): CicService {
		if (!CicService.instance) {
			CicService.instance = new CicService(tableName, logger, dynamoDbClient);
		}
		return CicService.instance;
	}

	async getSessionById(sessionId: string): Promise<ISessionItem | undefined> {
		this.logger.debug("Table name " + this.tableName);
		const getSessionCommand = new GetCommand({
			TableName: this.tableName,
			Key: {
				sessionId,
			},
		});

		let session;
		try {
			session = await this.dynamo.send(getSessionCommand);
		} catch (error: any) {
			this.logger.error({
				message: "getSessionById - failed executing get from dynamodb:",
				error,
				messageCode: MessageCodes.FAILED_FETCHING_SESSION,
			});
			throw new AppError(
				"Error retrieving Session",
				HttpCodesEnum.SERVER_ERROR,
			);
		}

		if (session.Item) {
			if (session.Item.expiryDate < absoluteTimeNow()) {
				this.logger.error("Session has expired", { messageCode: MessageCodes.EXPIRED_SESSION });
				throw new AppError(`Session with session id: ${sessionId} has expired`, HttpCodesEnum.UNAUTHORIZED);
			}
			return session.Item as ISessionItem;
		}
	}

	async getPersonIdentityBySessionId(sessionId: string): Promise<PersonIdentityItem | undefined> {
		this.logger.debug("Table name " + process.env.PERSON_IDENTITY_TABLE_NAME);
		const getPersonIdentityCommand = new GetCommand({
			TableName: process.env.PERSON_IDENTITY_TABLE_NAME,
			Key: {
				sessionId,
			},
		});

		let personIdentity;
		try {
			personIdentity = await this.dynamo.send(getPersonIdentityCommand);
		} catch (e: any) {
			this.logger.error({
				message: "getPersonIdentityBySessionId - failed executing get from dynamodb:",
				e,
			});
			throw new AppError(
				"Error retrieving Session",
				HttpCodesEnum.SERVER_ERROR,
			);
		}

		if (personIdentity.Item) {
			return personIdentity.Item as PersonIdentityItem;
		}
	}

	async saveCICData(sessionId: string, cicData: CicSession, sessionExpiry: number): Promise<void> {
		const personNames = this.mapCICNames(cicData.given_names, cicData.family_names);
		const personBirthDay = this.mapCICBirthDay(cicData.date_of_birth);

		const saveCICPersonInfoCommand: any = new UpdateCommand({
			TableName: process.env.PERSON_IDENTITY_TABLE_NAME,
			Key: { sessionId },
			UpdateExpression:
				"SET personNames = :personNames, birthDates = :date_of_birth, expiryDate = :expiryDate",

			ExpressionAttributeValues: {
				":personNames": personNames,
				":date_of_birth": personBirthDay,
				":expiryDate": sessionExpiry,
			},
		});

		const updateSessionAuthStateCommand: any = new UpdateCommand({
			TableName: this.tableName,
			Key: { sessionId },
			UpdateExpression:
				"SET authSessionState = :authSessionState",

			ExpressionAttributeValues: {
				":authSessionState": AuthSessionState.CIC_DATA_RECEIVED,
			},
		});

		this.logger.info({
			message: "Updating CIC data in dynamodb",
			tableName: this.tableName,
		});

		try {
			await this.dynamo.send(saveCICPersonInfoCommand);
			this.logger.info({ message: "updated CIC user info in dynamodb" });
		} catch (error) {
			this.logger.error({ message: "got error saving CIC user data", error });
			throw new AppError(
				"Failed to set claimed identity data ",
				HttpCodesEnum.SERVER_ERROR,
			);
		}

		try {
			await this.dynamo.send(updateSessionAuthStateCommand);
			this.logger.info({ message: "Updated CIC data in dynamodb" });
		} catch (error) {
			this.logger.error({ message: "Got error saving CIC data", error, messageCode: MessageCodes.FAILED_SAVING_PERSON_IDENTITY });
			throw new AppError(
				"Failed to set claimed identity data ",
				HttpCodesEnum.SERVER_ERROR,
			);
		}
	}


	async setAuthorizationCode(sessionId: string, uuid: string): Promise<void> {
		const updateSessionCommand = new UpdateCommand({
			TableName: this.tableName,
			Key: { sessionId },
			UpdateExpression:
				"SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry, authSessionState = :authSessionState",
			ExpressionAttributeValues: {
				":authCode": uuid,
				":authCodeExpiry": getAuthorizationCodeExpirationEpoch(
					process.env.AUTHORIZATION_CODE_TTL,
				),
				":authSessionState": AuthSessionState.CIC_AUTH_CODE_ISSUED,
			},
		});

		this.logger.info("Updating authorizationCode dynamodb", { tableName: this.tableName });

		try {
			await this.dynamo.send(updateSessionCommand);
			this.logger.info("Updated authorizationCode in dynamodb");
		} catch (error) {
			this.logger.error("Got error setting auth code", { error, messageCode: MessageCodes.FAILED_SAVING_AUTH_CODE });
			throw new AppError(
				"Failed to set authorization code ",
				HttpCodesEnum.SERVER_ERROR,
			);
		}
	}

	async sendToTXMA(event: TxmaEvent): Promise<void> {
		const messageBody = JSON.stringify(event);
		const params = {
			MessageBody: messageBody,
			QueueUrl: process.env.TXMA_QUEUE_URL,
		};

		this.logger.info("Sending message to TxMA", {
			event_name: event.event_name,
		});
		try {
			await createSqsClient().send(new SendMessageCommand(params));
			this.logger.info("Sent message to TxMA", {
				event_name: event.event_name,
			});

			const obfuscatedObject = await this.obfuscateJSONValues(event, Constants.TXMA_FIELDS_TO_SHOW);
			this.logger.info({ message: "Obfuscated TxMA Event", txmaEvent: JSON.stringify(obfuscatedObject, null, 2) });
		} catch (error) {
			this.logger.error("Error sending message to TxMA ", {
				error,
				messageCode: MessageCodes.FAILED_TO_WRITE_TXMA,
			});
			throw new AppError("Sending event - failed ", HttpCodesEnum.SERVER_ERROR);
		}
	}

	async getSessionByAuthorizationCode(
		code: string | undefined,
	): Promise<ISessionItem | undefined> {
		const params: QueryCommandInput = {
			TableName: this.tableName,
			IndexName: Constants.AUTHORIZATION_CODE_INDEX_NAME,
			KeyConditionExpression: "authorizationCode = :authorizationCode",
			ExpressionAttributeValues: {
				":authorizationCode": code,
			},
		};

		const sessionItem = await this.dynamo.query(params);

		if (!sessionItem?.Items || sessionItem?.Items?.length !== 1) {
			throw new AppError(
				"Error retrieving Session by authorization code",
				HttpCodesEnum.SERVER_ERROR,
			);
		}
		
		if (sessionItem.Items[0].expiryDate < absoluteTimeNow()) {
			throw new AppError(`Session with session id: ${sessionItem.Items[0].sessionId} has expired`, HttpCodesEnum.UNAUTHORIZED);
		}

		return sessionItem.Items[0] as ISessionItem;
	}

	async updateSessionWithAccessTokenDetails(
		sessionId: string,
		accessTokenExpiryDate: number,
	): Promise<void> {
		const updateAccessTokenDetailsCommand = new UpdateCommand({
			TableName: this.tableName,
			Key: { sessionId },
			UpdateExpression:
				"SET authSessionState = :authSessionState, accessTokenExpiryDate = :accessTokenExpiryDate REMOVE authorizationCode",
			ExpressionAttributeValues: {
				":authSessionState": AuthSessionState.CIC_ACCESS_TOKEN_ISSUED,
				":accessTokenExpiryDate": accessTokenExpiryDate,
			},
		});

		this.logger.info({
			message: "updating Access token details in dynamodb",
			updateAccessTokenDetailsCommand,
		});
		try {
			await this.dynamo.send(updateAccessTokenDetailsCommand);
			this.logger.info({ message: "updated Access token details in dynamodb" });
		} catch (error) {
			this.logger.error({
				message: "got error saving Access token details",
				error,
			});
			throw new AppError(
				"updateItem - failed: got error saving Access token details",
				HttpCodesEnum.SERVER_ERROR,
			);
		}
	}

	async createAuthSession(session: ISessionItem): Promise<void> {
		const putSessionCommand = new PutCommand({
			TableName: this.tableName,
			Item: session,
		});

		this.logger.info({
			message: "Saving session data in DynamoDB",
			tableName: this.tableName,
		});

		try {
			await this.dynamo.send(putSessionCommand);
			this.logger.info("Successfully created session in dynamodb");
		} catch (error) {
			this.logger.error("got error " + error);
			throw new AppError("saveItem - failed ", 500);
		}
	}

	private mapCICNames(givenNames: string[], familyName: string): PersonIdentityName[] {
		const nameParts: PersonIdentityNamePart[] = [];
	
		const validateName = (name: string) => {
			if (!Constants.GIVEN_NAME_REGEX.test(name)) {
				this.logger.error(`Name doesn't match regex expression: ${Constants.GIVEN_NAME_REGEX}`, { messageCode: MessageCodes.INVALID_NAME_REGEX });
				throw new AppError(`Name doesn't match regex expression: ${Constants.GIVEN_NAME_REGEX}`, HttpCodesEnum.BAD_REQUEST);
			}
		};
	
		givenNames.forEach((givenName) => {
			validateName(givenName);
			nameParts.push({
				type: "GivenName",
				value: givenName,
			});
		});
	
		validateName(familyName);
		nameParts.push({
			type: "FamilyName",
			value: familyName,
		});
	
		return [{ nameParts }];
	}

	private mapCICBirthDay(birthDay: string): PersonIdentityDateOfBirth[] {
		return [
			{
				value: birthDay,
			// eslint-disable-next-line max-lines
			},
		];
	}

	private createPersonIdentityItem(
		sharedClaims: SharedClaimsItem,
		sessionId: string,
		sessionExpirationEpoch: number,
	): PersonIdentityItem {
		return {
			sessionId,
			addresses: sharedClaims.address,
			birthDates: sharedClaims.birthDate,
			expiryDate: sessionExpirationEpoch,
			personNames: sharedClaims.name,
		};
	}

	async savePersonIdentity(
		sharedClaims: SharedClaimsItem,
		sessionId: string,
		expiryDate: number,
	): Promise<void> {
		const personIdentityItem = this.createPersonIdentityItem(
			sharedClaims,
			sessionId,
			expiryDate,
		);

		const putSessionCommand = new PutCommand({
			TableName: process.env.PERSON_IDENTITY_TABLE_NAME,
			Item: personIdentityItem,
		});
		await this.dynamo.send(putSessionCommand);
		return putSessionCommand?.input?.Item?.sessionId;
	}

	async obfuscateJSONValues(input: any, txmaFieldsToShow: string[] = []): Promise<any> {
		if (typeof input === "object" && input !== null) {
			if (Array.isArray(input)) {
				return Promise.all(input.map((element) => this.obfuscateJSONValues(element, txmaFieldsToShow)));
			} else {
				const obfuscatedObject: any = {};
				for (const key in input) {
					if (Object.prototype.hasOwnProperty.call(input, key)) {
						if (txmaFieldsToShow.includes(key)) {
							obfuscatedObject[key] = input[key];
						} else {
							obfuscatedObject[key] = await this.obfuscateJSONValues(input[key], txmaFieldsToShow);
						}
					}
				}
				return obfuscatedObject;
			}
		} else {
			return input === null || input === undefined ? input : "***";
		}
	}
}
