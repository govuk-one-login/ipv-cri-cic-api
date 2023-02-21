import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { Jwt, JwtPayload } from "../../../utils/IverifiedCredential";

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

    verify(_urlEncodedJwt: string): boolean { return this.result; }

    decode(_urlEncodedJwt: string): Jwt { return this.mockJwt; }

    sign(_jwtPayload: JwtPayload): string { return "signedJwt-test"; }
}
