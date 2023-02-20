"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CicResponse = void 0;
class CicResponse {
    constructor(data) {
        this.authorizationCode = data.authorizationCode;
        this.redirect_uri = data.redirect_uri;
        this.state = data.state;
    }
}
exports.CicResponse = CicResponse;
