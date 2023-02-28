import { JwtVerifier } from "./security/jwt-verifier";
import { JWTPayload } from "jose";
// import { SessionRequestValidationConfig } from "../types/session-request-validation-config";
// import { ClientConfigKey } from "../types/config-keys";
import { Logger } from "@aws-lambda-powertools/logger";
import { SessionValidationError } from "../types/errors";

interface SessionRequestValidationConfig {
    expectedJwtRedirectUri: string;
    expectedJwtIssuer: string;
    expectedJwtAudience: string;
}

enum ClientConfigKey {
    JWT_ISSUER = "issuer",
    JWT_AUDIENCE = "audience",
    JWT_PUBLIC_SIGNING_KEY = "publicSigningJwkBase64",
    JWT_REDIRECT_URI = "redirectUri",
    JWT_SIGNING_ALGORITHM = "authenticationAlg",
}

abstract class BaseError extends Error {
    constructor(
        public readonly message: string,
        public statusCode?: number,
        public code?: number,
        public readonly details?: string,
    ) {
        super(message);
    }
    getErrorSummary() {
        return this.code + ": " + this.message;
    }
}

class SessionValidationError extends BaseError {
    constructor(public readonly message: string, public readonly details?: string) {
        super(message);
        this.statusCode = 400;
        this.code = 1019;
        Object.setPrototypeOf(this, SessionValidationError.prototype);
    }
}

export class SessionRequestValidator {
    constructor(private validationConfig: SessionRequestValidationConfig, private jwtVerifier: JwtVerifier) {}
    async validateJwt(jwt: Buffer, requestBodyClientId: string): Promise<JWTPayload> {
        const expectedRedirectUri = this.validationConfig.expectedJwtRedirectUri;

        const payload = await this.verifyJwtSignature(jwt);
        if (!payload) {
            throw new SessionValidationError(
                "Session Validation Exception",
                "Invalid request: JWT validation/verification failed: JWT verification failure",
            );
        } else if (!payload.shared_claims) {
            throw new SessionValidationError(
                "Session Validation Exception",
                "Invalid request: JWT validation/verification failed: JWT payload missing shared claims",
            );
        } else if (payload.client_id !== requestBodyClientId) {
            throw new SessionValidationError(
                "Session Validation Exception",
                `Invalid request: JWT validation/verification failed: Mismatched client_id in request body (${requestBodyClientId}) & jwt (${payload.client_id})`,
            );
        } else if (!expectedRedirectUri) {
            throw new SessionValidationError(
                "Session Validation Exception",
                `Invalid request: JWT validation/verification failed: Unable to retrieve redirect URI for client_id: ${requestBodyClientId}`,
            );
        } else if (expectedRedirectUri !== payload.redirect_uri) {
            throw new SessionValidationError(
                "Session Validation Exception",
                `Invalid request: JWT validation/verification failed: Redirect uri ${payload.redirect_uri} does not match configuration uri ${expectedRedirectUri}`,
            );
        }

        return payload;
    }
    private async verifyJwtSignature(jwt: Buffer): Promise<JWTPayload | null> {
        const expectedIssuer = this.validationConfig.expectedJwtIssuer;
        const expectedAudience = this.validationConfig.expectedJwtAudience;
        return await this.jwtVerifier.verify(
            jwt,
            new Set([
                JwtVerifier.ClaimNames.EXPIRATION_TIME,
                JwtVerifier.ClaimNames.SUBJECT,
                JwtVerifier.ClaimNames.NOT_BEFORE,
            ]),
            new Map([
                [JwtVerifier.ClaimNames.AUDIENCE, expectedAudience],
                [JwtVerifier.ClaimNames.ISSUER, expectedIssuer],
            ]),
        );
    }
}