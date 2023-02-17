export class Response {
    constructor(statusCode, body, headers, multiValueHeaders) {
        this.statusCode = statusCode;
        this.body = body;
        this.headers = headers;
        this.multiValueHeaders = multiValueHeaders;
    }
}
