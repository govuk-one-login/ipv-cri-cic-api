import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { ISessionItem } from "../../models/ISessionItem";
import { constants } from "./ApiConstants";
import { jwtUtils } from "../../utils/JwtUtils";
import crypto from "node:crypto";

const API_INSTANCE = axios.create({ baseURL: constants.DEV_CRI_CIC_API_URL });
export const HARNESS_API_INSTANCE: AxiosInstance = axios.create({ baseURL: constants.DEV_CIC_TEST_HARNESS_URL });

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

export async function startStubServiceAndReturnSessionId(journeyType: string): Promise<string> {
	const stubResponse = await stubStartPost(journeyType);
	const sessionResponse = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);
	return sessionResponse.data.session_id;
}

interface StubPayload {
	context?: string;
	[key: string]: any;
}

interface KidOptions {
	kidType?: 'invalidKid' | 'missingKid';
	value?: boolean;
}

export async function stubStartPost(journeyType: string, options?: KidOptions): Promise<AxiosResponse<any>> {
	const path = constants.DEV_IPV_STUB_URL!;

	const payload: StubPayload = {};

	if (journeyType !== 'f2f') {
		payload.context = journeyType;
	}

	if (options && options.kidType) {
		payload[options.kidType] = options.value ?? false;
	}

	const postRequest: AxiosResponse<any> = await axios.post(path, payload);
	expect(postRequest.status).toBe(201);
	return postRequest;
}

export async function sessionPost(clientId?: string, request?: string): Promise<any> {
	const path = "/session";
	try {
		const postRequest = await API_INSTANCE.post(path, { client_id: clientId, request }, { headers: { "txma-audit-encoded": "encoded-header", "x-forwarded-for": "user ip address" } });
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

export async function validateJwtToken(responseString: any, data: any): Promise<void> {
	const [rawHead, rawBody] = JSON.stringify(getJwtTokenUserInfo(responseString)).split(".");
	await validateRawHead(rawHead);
	validateRawBody(rawBody, data);
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
export async function getSessionAndVerifyKey(sessionId: string, tableName: string, key: string, expectedValue: string): Promise<void> {
	const sessionInfo = await getSessionById(sessionId, tableName);
	try {
		expect(sessionInfo![key as keyof ISessionItem]).toBe(expectedValue);
	} catch (error: any) {
		throw new Error("getSessionAndVerifyKey - Failed to verify " + key + " value: " + error);
	}
}

export async function abortPost(sessionId: string): Promise<AxiosResponse<string>> {
	const path = "/abort";
	try {
		return await API_INSTANCE.post(path, null, { headers: { "x-govuk-signin-session-id": sessionId, "txma-audit-encoded": "encoded-header" } });
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	}
}


async function validateRawHead(rawHead: any): Promise<void> {
	const decodeRawHead = JSON.parse(jwtUtils.base64DecodeToString(rawHead.replace(/\W/g, "")));
	expect(decodeRawHead.alg).toBe("ES256");
	expect(decodeRawHead.typ).toBe("JWT");
	const msgBuffer = new TextEncoder().encode(constants.VC_SIGNING_KEY_ID);
	const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
	expect(decodeRawHead.kid).toBe("did:web:" + constants.DNS_SUFFIX + "#" + hashHex);
}

function validateRawBody(rawBody: any, data: any): void {
	const decodedRawBody = JSON.parse(jwtUtils.base64DecodeToString(rawBody.replace(/\W/g, "")));
	expect(decodedRawBody.vc.credentialSubject.name[0].nameParts[0].value).toBe(data.firstName);
	expect(decodedRawBody.vc.credentialSubject.name[0].nameParts[1].value).toBe(data.lastName);
	expect(decodedRawBody.vc.credentialSubject.birthDate[0].value).toBe(data.dateOfBirth);
}
