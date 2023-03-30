"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifiableCredentialService = void 0;
const AppError_1 = require("./AppError");
const HttpCodesEnum_1 = require("./HttpCodesEnum");
const Constants_1 = require("./Constants");
const crypto_1 = require("crypto");
class VerifiableCredentialService {
    constructor(tableName, kmsJwtAdapter, issuer, logger) {
        this.issuer = issuer;
        this.tableName = tableName;
        this.logger = logger;
        this.kmsJwtAdapter = kmsJwtAdapter;
    }
    static getInstance(tableName, kmsJwtAdapter, issuer, logger) {
        if (!VerifiableCredentialService.instance) {
            VerifiableCredentialService.instance = new VerifiableCredentialService(tableName, kmsJwtAdapter, issuer, logger);
        }
        return VerifiableCredentialService.instance;
    }
    async generateSignedVerifiableCredentialJwt(sessionItem, getNow) {
        const now = getNow();
        const subject = sessionItem?.subject;
        const nameParts = this.buildVcNamePart(sessionItem?.given_names, sessionItem?.family_names);
        const verifiedCredential = new VerifiableCredentialBuilder(nameParts, sessionItem?.date_of_birth)
            .build();
        const result = {
            sub: subject,
            nbf: now,
            iss: this.issuer,
            iat: now,
            jti: (0, crypto_1.randomUUID)(),
            vc: verifiedCredential,
        };
        this.logger.info({ message: "Verified Credential jwt: " }, JSON.stringify(result));
        try {
            // Sign the VC
            const signedVerifiedCredential = await this.kmsJwtAdapter.sign(result);
            return signedVerifiedCredential;
        }
        catch (error) {
            throw new AppError_1.AppError("Failed to sign Jwt", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
    }
    buildVcNamePart(given_names, family_names) {
        const parts = [];
        given_names?.forEach((givenName) => {
            parts.push({
                value: givenName,
                type: "GivenName",
            });
        });
        family_names?.forEach((familyName) => {
            parts.push({
                value: familyName,
                type: "FamilyName",
            });
        });
        return parts;
    }
}
exports.VerifiableCredentialService = VerifiableCredentialService;
class VerifiableCredentialBuilder {
    constructor(nameParts, date_of_birth) {
        this.credential = {
            "@context": [
                Constants_1.Constants.W3_BASE_CONTEXT,
                Constants_1.Constants.DI_CONTEXT,
            ],
            type: [
                Constants_1.Constants.VERIFIABLE_CREDENTIAL,
                Constants_1.Constants.IDENTITY_ASSERTION_CREDENTIAL,
            ],
            credentialSubject: {
                name: [
                    {
                        nameParts,
                    }
                ],
                birthDate: [{ value: date_of_birth }],
            },
        };
    }
    build() {
        return this.credential;
    }
}
