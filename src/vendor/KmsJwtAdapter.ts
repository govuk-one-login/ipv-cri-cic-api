import format from 'ecdsa-sig-formatter'
import { Buffer } from 'buffer'
import { CredentialJwt, JwtHeader } from "./IverifiedCredential"
import * as jose from 'node-jose'
import * as AWS from "@aws-sdk/client-kms";

export class KmsJwtAdapter {
    readonly kid: string;
    private kms = new AWS.KMS({
        region: process.env.REGION
    });
    /**
     * An implemention the JWS standard using KMS to sign Jwts
     *
     * kid: The key Id of the KMS key
     */
    ALG = 'ECDSA_SHA_256'
    constructor (kid: string) {
        this.kid = kid
    }

    async sign (jwtPayload: CredentialJwt){
        const jwtHeader: JwtHeader = { alg: 'ES256', typ: 'JWT' }
        const kid = this.kid.split('/').pop()
        if (kid != null) {
            jwtHeader.kid = kid
        }
        const tokenComponents = {
            header: jose.util.base64url.encode(Buffer.from(JSON.stringify(jwtHeader)), 'utf8'),
            payload: jose.util.base64url.encode(Buffer.from(JSON.stringify(jwtPayload)), 'utf8'),
            signature: ''
        }
        const params = {
            Message: Buffer.from(`${tokenComponents.header}.${tokenComponents.payload}`),
            KeyId: this.kid,
            SigningAlgorithm: this.ALG,
            MessageType: 'RAW'
        };
        const res = await this.kms.sign(params);
        if (res.Signature == null) {
            throw new Error('Failed to sign Jwt')
        }
        tokenComponents.signature = format.derToJose(Buffer.from(res.Signature).toString('base64'), 'ES256')
        return `${tokenComponents.header}.${tokenComponents.payload}.${tokenComponents.signature}`;
    }

}
