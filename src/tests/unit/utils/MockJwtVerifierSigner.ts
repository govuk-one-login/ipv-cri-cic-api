import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { Jwt, JwtPayload } from "../../../utils/IVeriCredential";

const ACCESS_TOKEN = "ACCESS_TOKEN";

export class MockKmsJwtAdapter {
    result: boolean;

    mockJwt: Jwt;

    constructor(result: boolean, mockJwT: Jwt = {
    	header: {
    		alg: "alg",
    		typ: "typ",
    		kid: "kid",
    	},
    	payload: {
    		iss: "issuer",
    		sub: "sessionId",
    		aud: "audience",
    		exp: absoluteTimeNow() + 1000,
    	},
    	signature: "testSignature",
    },
    ) {
    	this.result = result;
    	this.mockJwt = mockJwT;
    }

    verify(): boolean { return this.result; }

    decode(): Jwt { return this.mockJwt; }

    sign(): string { return "signedJwt-test"; }
}

export class MockFailingKmsSigningJwtAdapter {

	sign(): string { throw new Error("Failed to sign Jwt"); }
}

export class MockKmsSigningTokenJwtAdapter {

	sign(): string { return ACCESS_TOKEN; }
}

export class MockKmsJwtAdapterForVc {
    result: boolean;

    constructor(result: boolean) {
    	this.result = result;
    }

    verify(): boolean { return this.result; }

    sign(jwtPayload: JwtPayload): string {
    	return JSON.stringify(jwtPayload);
    }

    decode(): Jwt {
    	return {
    		header: {
    			alg: "MOCK",
    		},
    		payload: {
    			exp: absoluteTimeNow() + 300,
    			sub: "1234",
    		},
    		signature: "ABCDE",
    	};
    }
}
