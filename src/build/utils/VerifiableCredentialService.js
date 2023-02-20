"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifiableCredentialService = void 0;
const AppError_1 = require("./AppError");
const HttpCodesEnum_1 = require("./HttpCodesEnum");
const Constants_1 = require("./Constants");
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
        const subject = sessionItem?.clientId;
        const givenNames = sessionItem?.given_names?.join(" ");
        const famiyNames = sessionItem?.family_names?.join(" ");
        const verifiedCredential = new VerifiableCredentialBuilder(givenNames, famiyNames, sessionItem?.date_of_birth, sessionItem?.document_selected, sessionItem?.date_of_expiry)
            .build();
        const result = {
            iat: now,
            iss: this.issuer,
            aud: this.issuer,
            sub: subject,
            nbf: now,
            exp: now + Constants_1.Constants.CREDENTIAL_EXPIRY,
            vc: verifiedCredential,
        };
        this.logger.debug({ message: "Verified Credential jwt: " }, JSON.stringify(result));
        try {
            // Sign the VC
            const signedVerifiedCredential = await this.kmsJwtAdapter.sign(result);
            return signedVerifiedCredential;
        }
        catch (error) {
            throw new AppError_1.AppError("Failed to sign Jwt", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
    }
}
exports.VerifiableCredentialService = VerifiableCredentialService;
class VerifiableCredentialBuilder {
    constructor(given_names, family_names, date_of_birth, document_selected, date_of_expiry) {
        this.credential = {
            "@context": [
                Constants_1.Constants.W3_BASE_CONTEXT,
                Constants_1.Constants.DI_CONTEXT,
            ],
            type: [
                Constants_1.Constants.VERIFIABLE_CREDENTIAL,
                Constants_1.Constants.CLAIMED_IDENTITY_CREDENTIAL_TYPE,
            ],
            credentialSubject: {
                fullName: [
                    {
                        nameParts: [
                            {
                                type: "GivenName",
                                value: given_names,
                            },
                            {
                                type: "FamilyName",
                                value: family_names,
                            },
                        ],
                    }
                ],
                dateOfBirth: date_of_birth,
                documentType: document_selected,
                dateOfExpiry: date_of_expiry,
            },
        };
    }
    build() {
        return this.credential;
    }
}
