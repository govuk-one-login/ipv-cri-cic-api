"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unauthorizedResponse = exports.GenericServerError = exports.SECURITY_HEADERS = exports.Response = void 0;
const HttpCodesEnum_1 = require("./HttpCodesEnum");
class Response {
    constructor(statusCode, body, headers, multiValueHeaders) {
        this.statusCode = statusCode;
        this.body = body;
        this.headers = headers;
        this.multiValueHeaders = multiValueHeaders;
    }
}
exports.Response = Response;
exports.SECURITY_HEADERS = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "Strict-Transport-Security": "max-age=31536000",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
};
exports.GenericServerError = {
    statusCode: HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR,
    headers: exports.SECURITY_HEADERS,
    body: "Internal server error",
};
const unauthorizedResponse = (errorDescription) => {
    return {
        statusCode: HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED,
        headers: exports.SECURITY_HEADERS,
        body: JSON.stringify({
            redirect: null,
            message: errorDescription,
        }),
    };
};
exports.unauthorizedResponse = unauthorizedResponse;
