"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wellKnownGet = exports.userInfoPost = exports.tokenPost = exports.authorizationGet = exports.claimedIdentityPost = exports.sessionPost = exports.stubStartPost = void 0;
const axios_1 = __importDefault(require("axios"));
const API_INSTANCE = axios_1.default.create({ baseURL: "https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev" });
async function stubStartPost(body) {
    try {
        const path = "https://erveje5km8.execute-api.eu-west-2.amazonaws.com/dev/start";
        const postRequest = await axios_1.default.post(`${path}`, body);
        return postRequest;
    }
    catch (error) {
        console.log(`Error response from stub: ${error}`);
        return error.response;
    }
}
exports.stubStartPost = stubStartPost;
async function sessionPost(clientId, request) {
    try {
        const path = "/session";
        const postRequest = await API_INSTANCE.post(`${path}`, { client_id: clientId, request });
        return postRequest;
    }
    catch (error) {
        console.log(`Error response from stub: ${error}`);
        return error.response;
    }
}
exports.sessionPost = sessionPost;
async function claimedIdentityPost(given_names, family_names, dob, doc_selected, doe, sessID) {
    try {
        const path = "/claimedIdentity";
        const headers = { "x-govuk-signin-session-id": sessID };
        const postRequest = await API_INSTANCE.post(`${path}`, {
            given_names,
            family_names,
            date_of_birth: dob,
            document_selected: doc_selected,
            date_of_expiry: doe,
        }, {
            headers,
        });
        return postRequest;
    }
    catch (error) {
        console.log(`Error response from stub: ${error}`);
        return error.response;
    }
}
exports.claimedIdentityPost = claimedIdentityPost;
async function authorizationGet(sessionId) {
    try {
        const path = "/authorization";
        const headers = { "session-id": sessionId };
        const postRequest = await API_INSTANCE.get(`${path}`, { headers });
        return postRequest;
    }
    catch (error) {
        console.log(`Error response from stub: ${error}`);
        return error.response;
    }
}
exports.authorizationGet = authorizationGet;
async function tokenPost(authCode, redirectUri) {
    try {
        const path = "/token";
        const data = `code=${authCode}&grant_type=authorization_code&redirect_uri=${redirectUri}`;
        const postRequest = await API_INSTANCE.post(`${path}`, data, { headers: { "Content-Type": "text/plain" } });
        return postRequest;
    }
    catch (error) {
        console.log(`Error response from stub: ${error}`);
        return error.response;
    }
}
exports.tokenPost = tokenPost;
async function userInfoPost(accessToken) {
    try {
        const path = "/userInfo";
        const postRequest = await API_INSTANCE.post(path, null, { headers: { "Authorization": `Bearer ${accessToken}` } });
        return postRequest;
    }
    catch (error) {
        console.log(`Error response from stub: ${error}`);
        return error.response;
    }
}
exports.userInfoPost = userInfoPost;
async function wellKnownGet() {
    try {
        const path = "/.well-known/jwks.json";
        const postRequest = await API_INSTANCE.get(path);
        return postRequest;
    }
    catch (error) {
        console.log(`Error response from stub: ${error}`);
        return error.response;
    }
}
exports.wellKnownGet = wellKnownGet;
