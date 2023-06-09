import axios from "axios";
import { constants } from "../utils/ApiConstants";
import { jwtUtils } from "../../utils/JwtUtils";
const API_INSTANCE = axios.create({ baseURL:constants.DEV_CRI_CIC_API_URL });

export async function startStubServiceAndReturnSessionId(): Promise<any> {
	const stubResponse = await stubStartPost();
	return sessionPost(stubResponse.data.clientId, stubResponse.data.request);
}

export async function stubStartPost():Promise<any> {
	const path = constants.DEV_IPV_STUB_URL;
	const postRequest = await axios.post(`${path}`, { target:constants.DEV_CRI_CIC_API_URL });
	expect(postRequest.status).toBe(201);
	return postRequest;
}

export async function sessionPost(clientId?: string, request?: string):Promise<any> {
	const path = "/session";
	try {
		const postRequest = await API_INSTANCE.post(path, { client_id: clientId, request });
		expect(postRequest.status).toBe(200);
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export async function claimedIdentityPost(givenName: any, familyName: any, dob: any, sessionId?: any):Promise<any> {
	const path = "/claimedIdentity";
	try {
		const postRequest = await API_INSTANCE.post("/claimedIdentity", { 
			"given_names" : givenName, 
			"family_names" : familyName, 
			"date_of_birth": dob, 
		}, { headers:{ "x-govuk-signin-session-id": sessionId } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export async function authorizationGet(sessionId: any):Promise<any> {
	const path = "/authorization";
	try {
		const getRequest = await API_INSTANCE.get( "/authorization", { headers:{ "session-id": sessionId } });
		return getRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}   

export async function tokenPost(authCode?: any, redirectUri?: any ):Promise<any> {
	const path = "/token";
	try {
		const postRequest = await API_INSTANCE.post( "/token", `code=${authCode}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(redirectUri)}`, { headers:{ "Content-Type" : "text/plain" } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export async function userInfoPost(accessToken?: any):Promise<any> {
	const path = "/userinfo";
	try {
		const postRequest = await API_INSTANCE.post( "/userinfo", null, { headers: { "Authorization": `Bearer ${accessToken}` } });
		return postRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export async function wellKnownGet():Promise<any> {
	console.log(constants.DEV_CRI_CIC_API_URL);
	const path = "/.well-known/jwks.json";
	try {
		const getRequest = await API_INSTANCE.get( "/.well-known/jwks.json");	
		return getRequest;
	} catch (error: any) {
		console.log(`Error response from ${path} endpoint: ${error}`);
		return error.response;
	} 
}

export function validateJwtToken(responseString:any, data:any):void {
	const [rawHead, rawBody, signature] = JSON.stringify(getJwtTokenUserInfo(responseString)).split(".");
	validateRawHead(rawHead);
	validateRawBody(rawBody, data);
}


export function validateWellKnownReponse(response:any):void {
	expect(response.keys).toHaveLength(2);
	expect(response.keys[0].use).toBe("sig");
	expect(response.keys[1].use).toBe("enc");
}

function getJwtTokenUserInfo(responseString:any): any {
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

function validateRawHead(rawHead:any): void {
	const decodeRawHead = JSON.parse(jwtUtils.base64DecodeToString(rawHead.replace(/\W/g, "")));
	expect(decodeRawHead.alg).toBe("ES256");
	expect(decodeRawHead.typ).toBe("JWT");
}

function validateRawBody(rawBody:any, data: any): void {
	const decodedRawBody = JSON.parse(jwtUtils.base64DecodeToString(rawBody.replace(/\W/g, "")));
	expect(decodedRawBody.vc.credentialSubject.name[0].nameParts[0].value).toBe(data.firstName);
	expect(decodedRawBody.vc.credentialSubject.name[0].nameParts[1].value).toBe(data.lastName);
	expect(decodedRawBody.vc.credentialSubject.birthDate[0].value).toBe(data.dateOfBirth);
}

