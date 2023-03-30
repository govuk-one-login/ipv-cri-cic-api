"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockKmsJwtAdapterForVc = exports.MockKmsSigningTokenJwtAdapter = exports.MockFailingKmsSigningJwtAdapter = exports.MockKmsJwtAdapter = void 0;
const DateTimeUtils_1 = require("../../../utils/DateTimeUtils");
const ACCESS_TOKEN = "ACCESS_TOKEN";
class MockKmsJwtAdapter {
    constructor(result, mockJwT = {
        header: {
            alg: "alg",
            typ: "typ",
            kid: "kid",
        },
        payload: {
            iss: "issuer",
            sub: "sessionId",
            aud: "audience",
            exp: (0, DateTimeUtils_1.absoluteTimeNow)() + 1000,
        },
        signature: "testSignature",
    }) {
        this.result = result;
        this.mockJwt = mockJwT;
    }
    verify(_urlEncodedJwt) { return this.result; }
    decode(_urlEncodedJwt) { return this.mockJwt; }
    sign(_jwtPayload) { return "signedJwt-test"; }
}
exports.MockKmsJwtAdapter = MockKmsJwtAdapter;
class MockFailingKmsSigningJwtAdapter {
    sign(_jwtPayload) { throw new Error("Failed to sign Jwt"); }
}
exports.MockFailingKmsSigningJwtAdapter = MockFailingKmsSigningJwtAdapter;
class MockKmsSigningTokenJwtAdapter {
    sign(_jwtPayload) { return ACCESS_TOKEN; }
}
exports.MockKmsSigningTokenJwtAdapter = MockKmsSigningTokenJwtAdapter;
class MockKmsJwtAdapterForVc {
    constructor(result) {
        this.result = result;
    }
    verify(_urlEncodedJwt) { return this.result; }
    sign(jwtPayload) {
        return JSON.stringify(jwtPayload);
    }
}
exports.MockKmsJwtAdapterForVc = MockKmsJwtAdapterForVc;
