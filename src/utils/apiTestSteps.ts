import axios from "axios";
import { constants } from "./ApiConstants";
import { assertStatusCode, post, get } from "../utils/apiHelper";
const API_INSTANCE = axios.create({ baseURL:constants.DEV_CRI_CIC_API_URL });

export async function startStubServiceAndReturnSessionId(): Promise<any> {
	const stubResponse = await stubStartPost();
	const postRequest = await sessionPost(stubResponse.data.clientId, stubResponse.data.request);

	return postRequest;
}

export async function stubStartPost():Promise<any> {
	const path = constants.DEV_IPV_STUB_URL;
	const postRequest = await post(axios, `${path}`, { target:constants.DEV_CRI_CIC_API_URL }, null );
	assertStatusCode(201, postRequest.status, postRequest.statusText);
	return postRequest;
}

export async function sessionPost(clientId?: string, request?: string):Promise<any> {
	const path = "/session";
	try {
		const postRequest = await post(API_INSTANCE, path, { client_id: clientId, request }, null);
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export async function claimedIdentityPost(given_names?: string, family_names?: string, dob?: string, doc_selected?: string, doe?: string, sessionId?: string):Promise<any> {
	const path = "/claimedIdentity";
	try {
		const postRequest = await post(API_INSTANCE, "/claimedIdentity", { given_names, family_names, date_of_birth: dob, document_selected: doc_selected, date_of_expiry: doe }, { headers:{ "x-govuk-signin-session-id": sessionId } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export async function authorizationGet(sessionId: any):Promise<any> {
	const path = "/authorization";
	try {
		const getRequest = await get(API_INSTANCE, "/authorization", { headers:{ "session-id": sessionId } });
		return getRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}   

export async function tokenPost(authCode?: any, redirectUri?: any ):Promise<any> {
	const path = "/token";
	try {
		const postRequest = await post(API_INSTANCE, "/token", `code=${authCode}&grant_type=authorization_code&redirect_uri=${redirectUri}`, { headers:{ "Content-Type" : "text/plain" } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export async function userInfoPost(accessToken?: any):Promise<any> {
	const path = "/userInfo";
	try {
		const postRequest = await post(API_INSTANCE, "/userInfo", null, { headers: { "Authorization": `Bearer ${accessToken}` } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export async function wellKnownGet():Promise<any> {
	const path = "/.well-known/jwks.json";
	try {
		const getRequest = await get(API_INSTANCE, "/.well-known/jwks.json", null);	return getRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}
