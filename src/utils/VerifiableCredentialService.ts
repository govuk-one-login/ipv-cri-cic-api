import { Logger } from "@aws-lambda-powertools/logger";
import { VerifiedCredential } from "./IverifiedCredential";
import { KmsJwtAdapter } from "./KmsJwtAdapter";
import { ISessionItem } from "../models/ISessionItem";
import {AppError} from "./AppError";
import {HttpCodesEnum} from "./HttpCodesEnum";

const CREDENTIAL_EXPIRY = 15638400;

export class VerifiableCredentialService {
    readonly tableName: string;

    readonly logger: Logger;

    private readonly kmsJwtAdapter: KmsJwtAdapter;

    private static instance: VerifiableCredentialService;

    constructor(tableName: any, kmsJwtAdapter: KmsJwtAdapter, logger: Logger ) {
        this.tableName = tableName;
        this.logger = logger;
        this.kmsJwtAdapter = kmsJwtAdapter;
    }

    static getInstance(tableName: string, kmsJwtAdapter: KmsJwtAdapter, logger: Logger): VerifiableCredentialService {
        if (!VerifiableCredentialService.instance) {
            VerifiableCredentialService.instance = new VerifiableCredentialService(tableName, kmsJwtAdapter, logger);
        }
        return VerifiableCredentialService.instance;
    }

    async generateSignedVerifiableCredentialJwt(sessionItem: ISessionItem | undefined, getNow: () => number): Promise<string> {
        const now = getNow();
        // Retrieve the verifiable issuer from SSM Parameter (/verifiable-credential/issuer), hard coded with Dev account value.
        const issuer = "https://review-c.dev.account.gov.uk";
        //const expectedAudience = await configService.getJwtAudience(sessionItem.clientId); // common lib function
        // Retrieve the audience value from SSM Parameter (/jwtAuthentication/audience), hard coded with Dev account value.
        const expectedAudience = "https://review-c.dev.account.gov.uk";
        const subject = sessionItem?.clientId as string;
        const verifiedCredential: VerifiedCredential = new VerifiableCredentialBuilder(sessionItem?.full_name, sessionItem?.date_of_birth, sessionItem?.document_selected, sessionItem?.date_of_expiry)
            .build();
        const result = {
            iat: now,
            iss: issuer,
            aud: expectedAudience,
            sub: subject,
            nbf: now,
            exp: now + CREDENTIAL_EXPIRY,
            vc: verifiedCredential,
        };

        try {
            // Sign the VC
            const signedVerifiedCredential = await this.kmsJwtAdapter.sign(result);
            return signedVerifiedCredential;
        } catch (error) {
            throw new AppError( "Failed to sign Jwt", HttpCodesEnum.SERVER_ERROR);
        }
    }
}
class VerifiableCredentialBuilder {
    private readonly credential: VerifiedCredential;

    constructor(fullName: string | undefined, dateOfBirth: string | undefined, documentType: string | undefined, dateOfExpiry: string | undefined) {
        this.credential = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://vocab.account.gov.uk/contexts/identity-v1.jsonld",
            ],
            type: [
                "VerifiableCredential",
                "ClaimedIdentityCredential",
            ],
            credentialSubject: {
                fullName: [
                    { value: fullName }],
                dateOfBirth,
                documentType,
                dateOfExpiry,
            },
        };
    }

    build(): VerifiedCredential {
        return this.credential;
    }
}
