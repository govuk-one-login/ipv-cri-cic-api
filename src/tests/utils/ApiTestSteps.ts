import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import Ajv from "ajv";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { XMLParser } from "fast-xml-parser";
import { ISessionItem } from "../../models/ISessionItem";
import { constants } from "../utils/ApiConstants";
import { jwtUtils } from "../../utils/JwtUtils";

const API_INSTANCE = axios.create({ baseURL: constants.DEV_CRI_CIC_API_URL });
const HARNESS_API_INSTANCE: AxiosInstance = axios.create({ baseURL: constants.DEV_CIC_TEST_HARNESS_URL });

const customCredentialsProvider = {
	getCredentials: fromNodeProviderChain({
		timeout: 1000,
		maxRetries: 0,
	}),
};
const awsSigv4Interceptor = aws4Interceptor({
	options: {
		region: "eu-west-2",
		service: "execute-api",
	},
	credentials: customCredentialsProvider,
});

HARNESS_API_INSTANCE.interceptors.request.use(awsSigv4Interceptor);

const xmlParser = new XMLParser();
const ajv = new Ajv({ strictTuples: false });

export async function startStubServiceAndReturnSessionId(journeyType: string): Promise<any> {
	const stubResponse = await stubStartPost(journeyType);
	return sessionPost(stubResponse.data.clientId, stubResponse.data.request);
}

export async function stubStartPost(journeyType: string): Promise<any> {
	const path = constants.DEV_IPV_STUB_URL;

	let postRequest: AxiosResponse;
	switch (journeyType) {
		case "NO_PHOTO_ID":
			postRequest = await axios.post(`${path}`, { context: "bank_account" });
			break;
		case "INVALID":
			postRequest = await axios.post(`${path}`, { context: "INVALID" });
			break;
		default:
			postRequest = await axios.post(`${path}`);
			break;
	}

	expect(postRequest.status).toBe(201);
	return postRequest;
}

export async function sessionPost(clientId?: string, request?: string): Promise<any> {
	const path = "/session";
	try {
		const postRequest = await API_INSTANCE.post(path, { client_id: clientId, request });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}
}

export async function sessionConfigGet(sessionId: string): Promise<any> {
	const path = "/session-config";
	try {
		const getRequest = await API_INSTANCE.get(path, { headers: { "x-govuk-signin-session-id": sessionId } });
		return getRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}
}

export async function claimedIdentityPost(givenName: string | null, familyName: string | null, dob: string | null, sessionId?: string): Promise<any> {
	const path = "/claimedIdentity";
	try {
		const postRequest = await API_INSTANCE.post(path, {
			"given_names": givenName,
			"family_names": familyName,
			"date_of_birth": dob,
		}, { headers: { "x-govuk-signin-session-id": sessionId } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}
}

export async function authorizationGet(sessionId: any): Promise<any> {
	const path = "/authorization";
	try {
		const getRequest = await API_INSTANCE.get(path, { headers: { "session-id": sessionId } });
		return getRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}
}

export async function tokenPost(authCode?: any, redirectUri?: any): Promise<any> {
	const path = "/token";
	try {
		const postRequest = await API_INSTANCE.post(path, `code=${authCode}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(redirectUri)}`, { headers: { "Content-Type": "text/plain" } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}
}

export async function userInfoPost(accessToken?: any): Promise<any> {
	const path = "/userinfo";
	try {
		const postRequest = await API_INSTANCE.post(path, null, { headers: { "Authorization": `Bearer ${accessToken}` } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}
}

export async function wellKnownGet(): Promise<any> {
	const path = "/.well-known/jwks.json";
	try {
		const getRequest = await API_INSTANCE.get(path);
		return getRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}
}

export function validateJwtToken(responseString: any, data: any): void {
	const [rawHead, rawBody, signature] = JSON.stringify(getJwtTokenUserInfo(responseString)).split(".");
	validateRawHead(rawHead);
	validateRawBody(rawBody, data);
}

export function validateWellKnownResponse(response: any): void {
	expect(response.keys).toHaveLength(2);
	expect(response.keys[0].use).toBe("sig");
	expect(response.keys[1].use).toBe("enc");
}

function getJwtTokenUserInfo(responseString: any): any {
	try {
		const matches = responseString.match(/\[(.*?)\]/g);
		const result = [];
		if (matches) {
			for (let i = 0; i < matches.length; ++i) {
				const match = matches[i];
				result.push(match.substring(1, match.length - 1));
			}
		}
		return JSON.stringify(result);
	} catch (error: any) {
		console.log(`Error response getting JWT Token from /userInfo endpoint: ${error}`);
		return error.response;
	}
}

export async function getSessionById(sessionId: string, tableName: string): Promise<ISessionItem | undefined> {
	interface OriginalValue {
		N?: string;
		S?: string;
	}

	interface OriginalSessionItem {
		[key: string]: OriginalValue;
	}

	let session: ISessionItem | undefined;
	try {
		const response = await HARNESS_API_INSTANCE.get<{ Item: OriginalSessionItem }>(`getRecordBySessionId/${tableName}/${sessionId}`, {});
		const originalSession = response.data.Item;
		session = Object.fromEntries(
			Object.entries(originalSession).map(([key, value]) => [key, value.N ?? value.S]),
		) as unknown as ISessionItem;
		console.log("getSessionById Response", session);
	} catch (error: any) {
		console.error({ message: "getSessionById - failed getting session from Dynamo", error });
	}

	return session;
}

export async function getSessionByAuthCode(sessionId: string, tableName: string): Promise<ISessionItem | undefined> {
	let session;
	try {
		const response = await HARNESS_API_INSTANCE.get(`getSessionByAuthCode/${tableName}/${sessionId}`, {});
		session = response.data;
	} catch (e: any) {
		console.error({ message: "getSessionByAuthCode - failed getting session from Dynamo", e });
	}

	console.log("getSessionByAuthCode Response", session.Items[0]);
	return session.Items[0] as ISessionItem;
}

export async function getKeyFromSession(sessionId: string, tableName: string, key: string): Promise<any> {
	const sessionInfo = await getSessionById(sessionId, tableName);
	try {
		return sessionInfo![key as keyof ISessionItem];
	} catch (e: any) {
		throw new Error("getKeyFromSession - Failed to get " + key + " value: " + e);
	}
}

function validateRawHead(rawHead: any): void {
	const decodeRawHead = JSON.parse(jwtUtils.base64DecodeToString(rawHead.replace(/\W/g, "")));
	expect(decodeRawHead.alg).toBe("ES256");
	expect(decodeRawHead.typ).toBe("JWT");
}

function validateRawBody(rawBody: any, data: any): void {
	const decodedRawBody = JSON.parse(jwtUtils.base64DecodeToString(rawBody.replace(/\W/g, "")));
	expect(decodedRawBody.vc.credentialSubject.name[0].nameParts[0].value).toBe(data.firstName);
	expect(decodedRawBody.vc.credentialSubject.name[0].nameParts[1].value).toBe(data.lastName);
	expect(decodedRawBody.vc.credentialSubject.birthDate[0].value).toBe(data.dateOfBirth);
}

export async function getDequeuedSqsMessage(prefix: string): Promise<any> {
	const listObjectsResponse = await HARNESS_API_INSTANCE.get("/bucket/", {
		params: {
			prefix: "txma/" + prefix,
		},
	});
	const listObjectsParsedResponse = xmlParser.parse(listObjectsResponse.data);
	if (!listObjectsParsedResponse?.ListBucketResult?.Contents) {
		return undefined;
	}
	let key: string;
	if (Array.isArray(listObjectsParsedResponse?.ListBucketResult?.Contents)) {
		key = listObjectsParsedResponse.ListBucketResult.Contents.at(-1).Key;
	} else {
		key = listObjectsParsedResponse.ListBucketResult.Contents.Key;
	}

	const getObjectResponse = await HARNESS_API_INSTANCE.get("/object/" + key, {});
	return getObjectResponse.data;
}

export async function getSqsEventList(folder: string, prefix: string, txmaEventSize: number): Promise<any> {
	let contents: any[];
	let keyList: string[];

	do {
		await new Promise(res => setTimeout(res, 3000));

		const listObjectsResponse = await HARNESS_API_INSTANCE.get("/bucket/", {
			params: {
				prefix: folder + prefix,
			},
		});
		const listObjectsParsedResponse = xmlParser.parse(listObjectsResponse.data);
		contents = listObjectsParsedResponse?.ListBucketResult?.Contents;

		if (!contents || !contents.length) {
			return undefined;
		}

		keyList = contents.map(({ Key }) => Key);

	} while (contents.length < txmaEventSize);

	return keyList;
}


export async function validateTxMAEventData(keyList: any, journeyType: string): Promise<any> {
	let i: any;
	for (i = 0; i < keyList.length; i++) {
		const getObjectResponse = await HARNESS_API_INSTANCE.get("/object/" + keyList[i], {});
		console.log(JSON.stringify(getObjectResponse.data));
		let valid = true;
		if (getObjectResponse.data.event_name === "CIC_CRI_START" && journeyType === "NO_PHOTO_ID") {
			import("../data/" + getObjectResponse.data.event_name + "BANK_ACCOUNT_SCHEMA.json")
			.then((jsonSchema) => {
				const validate = ajv.compile(jsonSchema);
				valid = validate(getObjectResponse.data);
				if (!valid) {
					console.error(getObjectResponse.data.event_name + " Event Errors: " + JSON.stringify(validate.errors));
				}
			})
			.catch((err) => {
				console.log(err.message);
			})
			.finally(() => {
				expect(valid).toBe(true);
			});
		} else {
			import("../data/" + getObjectResponse.data.event_name + "_SCHEMA.json")
			.then((jsonSchema) => {
				const validate = ajv.compile(jsonSchema);
				valid = validate(getObjectResponse.data);
				if (!valid) {
					console.error(getObjectResponse.data.event_name + " Event Errors: " + JSON.stringify(validate.errors));
				}
			})
			.catch((err) => {
				console.log(err.message);
			})
			.finally(() => {
				expect(valid).toBe(true);
			});
		}
	}
}

export async function validateBankAccountCriStartTxMAEvent(key: any, context: string): Promise<any> {
	const getObjectResponse = await HARNESS_API_INSTANCE.get("/object/" + key, {});
	if (getObjectResponse.data.event_name === "CIC_CRI_START") {
		console.log(JSON.stringify(getObjectResponse.data, null, 2));
		expect(getObjectResponse.data.extensions.evidence.context).toBe(context);
	}
}
