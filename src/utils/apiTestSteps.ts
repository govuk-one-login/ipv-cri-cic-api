import axios from "axios";
const API_INSTANCE = axios.create({ baseURL:"https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev" });

export async function stubStartPost(body:any):Promise<any> {
	try {

		const path = "https://erveje5km8.execute-api.eu-west-2.amazonaws.com/dev/start";
		const postRequest = await axios.post(`${path}`, body);
		return postRequest;

	} catch (error: any) {
		console.log(`Error response from stub: ${error}`);
		return error.response;
	}
}

export async function sessionPost(clientId?: string, request?: string):Promise<any> {
	try {

		const path = "/session";
		const postRequest = await API_INSTANCE.post(`${path}`, { client_id: clientId, request });
		return postRequest;

	} catch (error: any) {
		console.log(`Error response from stub: ${error}`);
		return error.response;
	}
}

export async function claimedIdentityPost(given_names?: string, family_names?: string, dob?: string, doc_selected?: string, doe?: string, sessID?: string):Promise<any> {
	try {

		const path = "/claimedIdentity";
		const headers = { "x-govuk-signin-session-id": sessID };
		const postRequest = await API_INSTANCE.post(`${path}`, {
			given_names,
			family_names,
			date_of_birth: dob,
			document_selected: doc_selected,
			date_of_expiry: doe,
		},
		{
			headers,
		});
		return postRequest;

	} catch (error: any) {
		console.log(`Error response from stub: ${error}`);
		return error.response;
	}
}

export async function authorizationGet(sessionId: string):Promise<any> {
	try {
		
		const path = "/authorization";
		const headers = { "session-id": sessionId };
		const postRequest = await API_INSTANCE.get(`${path}`, { headers });
		return postRequest;

	} catch (error: any) {
		console.log(`Error response from stub: ${error}`);
		return error.response;
	}
}   

export async function tokenPost(authCode?: any, redirectUri?: any ):Promise<any> {
	try {
		const path = "/token";

		const data = `code=${authCode}&grant_type=authorization_code&redirect_uri=${redirectUri}`;
		const postRequest = await API_INSTANCE.post(`${path}`, data, { headers:{ "Content-Type" : "text/plain" } });
        
		return postRequest;
        
	} catch (error: any) {
		console.log(`Error response from stub: ${error}`);
		return error.response;
	}
}

export async function userInfoPost(accessToken?: any):Promise<any> {
	try {
		const path = "/userInfo";
        
		const postRequest = await API_INSTANCE.post(path, null, { headers: { "Authorization": `Bearer ${accessToken}` } });
        
		return postRequest;
        
	} catch (error: any) {
		console.log(`Error response from stub: ${error}`);
		return error.response;
	}
}

export async function wellKnownGet():Promise<any> {
	try {
		const path = "/.well-known/jwks.json";
        
		const postRequest = await API_INSTANCE.get(path);
        
		return postRequest;
        
	} catch (error: any) {
		console.log(`Error response from stub: ${error}`);
		return error.response;
	}
}