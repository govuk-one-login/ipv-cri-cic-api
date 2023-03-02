/* eslint-disable no-console */
import { CicSession } from "../models/CicSession";
import { ISessionItem } from "../models/ISessionItem";
import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "../utils/AppError";
import { DynamoDBDocument, GetCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { getAuthorizationCodeExpirationEpoch } from "../utils/DateTimeUtils";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Address, BirthDate, Name, PersonIdentity,  } from "../models/PersonIdentity";
import {
	PersonIdentityAddress,
	PersonIdentityDateOfBirth,
	PersonIdentityItem,
	PersonIdentityName,
} from "../models/PersonIdentityItem";
import {AuthSessionState} from "../models/enums/AuthSessionState";

export class CicService {
	readonly tableName: string;

	private readonly dynamo: DynamoDBDocument;

	readonly logger: Logger;

	private static instance: CicService;

	constructor(tableName: any, logger: Logger, dynamoDbClient: DynamoDBDocument) {
		this.tableName = tableName;
		this.dynamo = dynamoDbClient;
		this.logger = logger;
	}

	static getInstance(tableName: string, logger: Logger, dynamoDbClient: DynamoDBDocument): CicService {
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
		} catch (e: any) {
			this.logger.error({ message: "getSessionById - failed executing get from dynamodb:", e });
			throw new AppError("Error retrieving Session", HttpCodesEnum.SERVER_ERROR);
		}

		if (session.Item) {
			return session.Item as ISessionItem;
		}

	}

	async saveCICData(sessionId: string, cicData: CicSession): Promise<void> {

		const saveCICCommand: any = new UpdateCommand({
			TableName: this.tableName,
			Key: { sessionId },
			UpdateExpression: "SET full_name = :full_name, date_of_birth = :date_of_birth, document_selected = :document_selected, date_of_expiry =:date_of_expiry, authSessionState = :authSessionState",

			ExpressionAttributeValues: {
				":full_name": cicData.full_name,
				":date_of_birth": cicData.date_of_birth,
				":document_selected": cicData.document_selected,
				":date_of_expiry": cicData.date_of_expiry,
				":authSessionState": AuthSessionState.CIC_DATA_RECEIVED,
			},
		});

		this.logger.info({ message: "updating CIC data in dynamodb", saveCICCommand });
		try {
			await this.dynamo.send(saveCICCommand);
			this.logger.info({ message: "updated CIC data in dynamodb" });
		} catch (error) {
			this.logger.error({ message: "got error saving CIC data", error });
			throw new AppError("Failed to set claimed identity data ", HttpCodesEnum.SERVER_ERROR);
		}
	}

	async setAuthorizationCode(sessionId: string, uuid: string): Promise<void> {

		const updateSessionCommand = new UpdateCommand({
			TableName: this.tableName,
			Key: { sessionId },
			UpdateExpression: "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry, authSessionState = :authSessionState",
			ExpressionAttributeValues: {
				":authCode": uuid,
				":authCodeExpiry": getAuthorizationCodeExpirationEpoch(process.env.AUTHORIZATION_CODE_TTL),
				":authSessionState": AuthSessionState.CIC_AUTH_CODE_ISSUED,
			},
		});

		this.logger.info({ message: "updating authorizationCode dynamodb", updateSessionCommand });

		try {
			await this.dynamo.send(updateSessionCommand);
			this.logger.info({ message: "updated authorizationCode in dynamodb" });
		} catch (e: any) {
			this.logger.error({ message: "got error setting auth code", e });
			throw new AppError("Failed to set authorization code ", HttpCodesEnum.SERVER_ERROR);
		}
	}

	async createAuthSession(session: ISessionItem): Promise<void> {
		const putSessionCommand = new PutCommand({
			TableName: this.tableName,
			Item: session,
		});
		this.logger.info("Saving session data in dynamodb" + JSON.stringify(putSessionCommand));

		try {
			await this.dynamo.send(putSessionCommand);
			this.logger.info("Successfully created session in dynamodb");
		} catch (error) {
			this.logger.error("got error " + error);
			throw new AppError("saveItem - failed ", 500);
		}
	}

	private mapAddresses(addresses: Address[]): PersonIdentityAddress[] {
		return addresses?.map((address) => ({
			uprn: address.uprn,
			organisationName: address.organisationName,
			departmentName: address.departmentName,
			subBuildingName: address.subBuildingName,
			buildingNumber: address.buildingNumber,
			buildingName: address.buildingName,
			dependentStreetName: address.dependentStreetName,
			streetName: address.streetName,
			addressCountry: address.addressCountry,
			postalCode: address.postalCode,
			addressLocality: address.addressLocality,
			dependentAddressLocality: address.dependentAddressLocality,
			doubleDependentAddressLocality: address.doubleDependentAddressLocality,
			validFrom: address.validFrom,
			validUntil: address.validUntil,
		}));
	}
	private mapBirthDates(birthDates: BirthDate[]): PersonIdentityDateOfBirth[] {
		return birthDates?.map((bd) => ({ value: bd.value }));
	}
	private mapNames(names: Name[]): PersonIdentityName[] {
		return names?.map((name) => ({
			nameParts: name?.nameParts?.map((namePart) => ({
				type: namePart.type,
				value: namePart.value,
			})),
		}));
	}
	private createPersonIdentityItem(
		sharedClaims: PersonIdentity,
		sessionId: string,
		sessionExpirationEpoch: number,
	): PersonIdentityItem {
		return {
			sessionId: sessionId,
			addresses: this.mapAddresses(sharedClaims.address),
			birthDates: this.mapBirthDates(sharedClaims.birthDate),
			expiryDate: sessionExpirationEpoch,
			names: this.mapNames(sharedClaims.name),
		};
	}


	async savePersonIdentity(sharedClaims: PersonIdentity, sessionId: string, expiryDate: number): Promise<void> {
		const personIdentityItem = this.createPersonIdentityItem(sharedClaims, sessionId, expiryDate);

		const putSessionCommand = new PutCommand({
			TableName: process.env.PERSON_IDENTITY_TABLE_NAME,
			Item: personIdentityItem,
		});
		await this.dynamo.send(putSessionCommand);
		return putSessionCommand?.input?.Item?.sessionId;
	}

	async sendToTXMA(messageBody: string): Promise<void> {
		const params = {
			QueueUrl: process.env.TXMA_QUEUE_URL,
			MessageBody: messageBody,
		};

		this.logger.info("Sending event to SQS Qeue" + JSON.stringify(messageBody));
		try {
			const client = new SQSClient({ region: process.env.REGION });
			await client.send(new SendMessageCommand(params));
			this.logger.info("Event sent to SQS");
		} catch (error) {
			this.logger.error("Error sending to SQS" + error);
			throw new AppError("Error sedning to SQS", 500);
		}
	}
}
