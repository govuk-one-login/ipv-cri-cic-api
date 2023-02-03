/* eslint-disable no-console */
import {SessionItem} from "../models/SessionItem";
import { Logger } from '@aws-lambda-powertools/logger';
import {VerifiedCredential} from "./IverifiedCredential";
import {KmsJwtAdapter} from "./KmsJwtAdapter";

const CREDENTIAL_EXPIRY = 15638400

export class VerifiableCredentialService {
    readonly tableName: string
    //private readonly dynamo: DynamoDBClient;
    readonly logger: Logger;
    private readonly kmsJwtAdapter: KmsJwtAdapter;
    private static instance: VerifiableCredentialService;
    // Retrieve kid value from SSM parameter :verifiableCredentialKmsSigningKeyId, hard coded to value from Dev account
    //private readonly kid = "d5eb194b-cca5-4845-b892-236afc442448";
    private readonly kid = "arn:aws:kms:eu-west-2:322814139578:key/b7106ddd-ef9f-4a15-97af-096117a1ba56"//di-ipv-cri-dev value

    constructor(tableName: any, logger: Logger ) {
        //throw error if tableName is null
        this.tableName = tableName;
        //this.dynamo = new DynamoDBClient();
        this.logger = logger;
        this.kmsJwtAdapter = new KmsJwtAdapter(this.kid);
    }

    static getInstance(tableName: string, logger: Logger): VerifiableCredentialService {
        if (!VerifiableCredentialService.instance) {
            VerifiableCredentialService.instance = new VerifiableCredentialService(tableName, logger);
        }
        return VerifiableCredentialService.instance;
    }

    async generateSignedVerifiableCredentialJwt(sessionItem: SessionItem | undefined,  getNow: () => number): Promise<string> {
        const now = getNow();
        // Retrieve the verifiable issuer from SSM Parameter (/verifiable-credential/issuer), hard coded with Dev account value.
        const issuer = "https://review-c.dev.account.gov.uk"
        //const expectedAudience = await configService.getJwtAudience(sessionItem.clientId); // common lib function
        // Retrieve the audience value from SSM Parameter (/jwtAuthentication/audience), hard coded with Dev account value.
        const expectedAudience = "https://review-c.dev.account.gov.uk"
        const subject = sessionItem?.clientId as string;
        const verifiedCredential: VerifiedCredential = new VerifiableCredentialBuilder(sessionItem?.fullName, sessionItem?.dateOfBirth, sessionItem?.documentSelected, sessionItem?.dateOfExpiry)
            .build()
        const result = {
            iat: now,
            iss: issuer,
            aud: expectedAudience,
            sub: subject,
            nbf: now,
            exp: now + CREDENTIAL_EXPIRY,
            vc: verifiedCredential
        }
        // Sign the result done by commons libs jwt-verifier
        const signedVerifiedCredential = await this.kmsJwtAdapter.sign(result);
        // TODO Check for error while signing the vc and throw App error and log it.
        return signedVerifiedCredential;
    }
}
class VerifiableCredentialBuilder {
    private readonly credential: VerifiedCredential
    constructor (fullName: string | undefined, dateOfBirth: string | undefined, documentType: string | undefined, dateOfExpiry: string | undefined) {
        this.credential = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://vocab.account.gov.uk/contexts/identity-v1.jsonld'
            ],
            type: [
                'VerifiableCredential',
                'ClaimedIdentityCredential'
            ],
            credentialSubject: {
                fullName: [
                    {value: fullName }],
                dateOfBirth: dateOfBirth,
                documentType: documentType,
                dateOfExpiry: dateOfExpiry
            }
        }
    }
    build (): VerifiedCredential {
        return this.credential
    }
}
