import Ajv from "ajv";
import { XMLParser } from "fast-xml-parser";
import { HARNESS_API_INSTANCE } from "./ApiTestSteps";
import { TxmaEvent, TxmaEventName } from "../../utils/TxmaEvent";
import * as CIC_CRI_START_SCHEMA from "../data/CIC_CRI_START_SCHEMA.json";
import * as CIC_CRI_START_BANK_ACCOUNT_SCHEMA from "../data/CIC_CRI_START_BANK_ACCOUNT_SCHEMA.json";
import * as CIC_CRI_START_LOW_CONFIDENCE_SCHEMA from "../data/CIC_CRI_START_LOW_CONFIDENCE_SCHEMA.json";
import * as CIC_CRI_AUTH_CODE_ISSUED_SCHEMA from "../data/CIC_CRI_AUTH_CODE_ISSUED_SCHEMA.json";
import * as CIC_CRI_END_SCHEMA from "../data/CIC_CRI_END_SCHEMA.json";
import * as CIC_CRI_VC_ISSUED_SCHEMA from "../data/CIC_CRI_VC_ISSUED_SCHEMA.json";
import * as CIC_CRI_SESSION_ABORTED_SCHEMA from "../data/CIC_CRI_SESSION_ABORTED_SCHEMA.json";

const ajv = new Ajv({ strictTuples: false });
ajv.addSchema(CIC_CRI_START_SCHEMA, "CIC_CRI_START_SCHEMA");
ajv.addSchema(CIC_CRI_START_LOW_CONFIDENCE_SCHEMA, "CIC_CRI_START_LOW_CONFIDENCE_SCHEMA");
ajv.addSchema(CIC_CRI_START_BANK_ACCOUNT_SCHEMA, "CIC_CRI_START_BANK_ACCOUNT_SCHEMA");
ajv.addSchema(CIC_CRI_AUTH_CODE_ISSUED_SCHEMA, "CIC_CRI_AUTH_CODE_ISSUED_SCHEMA");
ajv.addSchema(CIC_CRI_END_SCHEMA, "CIC_CRI_END_SCHEMA");
ajv.addSchema(CIC_CRI_VC_ISSUED_SCHEMA, "CIC_CRI_VC_ISSUED_SCHEMA");
ajv.addSchema(CIC_CRI_SESSION_ABORTED_SCHEMA, "CIC_CRI_SESSION_ABORTED_SCHEMA");

const xmlParser = new XMLParser();

interface TestHarnessReponse {
	data: TxmaEvent;
}

interface AllTxmaEvents {
	"CIC_CRI_START"?: TxmaEvent;
	"CIC_CRI_AUTH_CODE_ISSUED"?: TxmaEvent;
	"CIC_CRI_END"?: TxmaEvent;
	"CIC_CRI_VC_ISSUED"?: TxmaEvent;
	"CIC_CRI_SESSION_ABORTED"?: TxmaEvent;
}

const getTxMAS3FileNames = async (prefix: string): Promise<any> => {
	const listObjectsResponse = await HARNESS_API_INSTANCE.get("/bucket/", {
		params: {
			prefix: "txma/" + prefix,
		},
	});
	const listObjectsParsedResponse = xmlParser.parse(listObjectsResponse.data);
	return listObjectsParsedResponse?.ListBucketResult?.Contents;
};

const getAllTxMAS3FileContents = async (fileNames: any[]): Promise<AllTxmaEvents> => {
	const allContents  = await fileNames.reduce(
		async (accumulator: Promise<AllTxmaEvents>, fileName: any) => {
			const resolvedAccumulator = await accumulator;

			const eventContents: TestHarnessReponse = await HARNESS_API_INSTANCE.get("/object/" + fileName.Key, {});
			resolvedAccumulator[eventContents?.data?.event_name] = eventContents.data;

			return resolvedAccumulator;
		}, Promise.resolve({}),
	);

	return allContents;
};

export async function getTxmaEventsFromTestHarness(sessionId: string, numberOfTxMAEvents: number): Promise<any> {
	let objectList: AllTxmaEvents = {};
	let fileNames: any = [];

	await new Promise(res => setTimeout(res, 3000));
	fileNames = await getTxMAS3FileNames(sessionId);

	// AWS returns an array for multiple but an object for single
	if (numberOfTxMAEvents === 1) {
		if (!fileNames || !fileNames.Key) {
			console.log(`No TxMA events found for session ID ${sessionId}`);
			return undefined;
		}
	
		const eventContents: TestHarnessReponse = await HARNESS_API_INSTANCE.get("/object/" + fileNames.Key, {});
		objectList[eventContents?.data?.event_name] = eventContents.data;
	} else {
		if (!fileNames || !fileNames.length) {
			console.log(`No TxMA events found for session ID ${sessionId}`);
			return undefined;
		}

		const additionalObjectList = await getAllTxMAS3FileContents(fileNames);
		objectList = { ...objectList, ...additionalObjectList };
	}
	return objectList;
}

export function validateTxMAEventData(
	{ eventName, schemaName }: { eventName: TxmaEventName; schemaName: string }, allTxmaEventBodies: AllTxmaEvents = {}, 
): void {
	const currentEventBody: TxmaEvent | undefined = allTxmaEventBodies[eventName];

	if (currentEventBody?.event_name) {
		try {
			const validate = ajv.getSchema(schemaName);
			if (validate) {
				expect(validate(currentEventBody)).toBe(true);
			} else {
				throw new Error(`Could not find schema ${schemaName}`);
			}
		} catch (error) {
			console.error("Error validating event", error);
			throw error;
		}
	} else {
		throw new Error(`No event found in the test harness for ${eventName} event`);
	}
}
