import jose from 'node-jose'
import { Jwt, Jwks, IVerifyJwts } from '../IVeriCredential'
import { jwtUtils } from '../JwtUtils'
import { IGetPublicKeys } from './PublicKeyGetter'

export class JwksJwtAdapter implements IVerifyJwts {
  readonly publicKeyGetter: IGetPublicKeys
  readonly ALG = 'ECDSA_SHA_256'

  /**
   * An implementation of the JWS standard using KMS to sign and encrypt, and a clients JWKS endpoint to verify and decrypt
   *
   * jwkEndpoint: The .wellknown endpoint that the Client JWKs are hosted on
   * kid: The key Id, Key ARN, or key alias of the KMS key
   */
  constructor (publicKeyGetter: IGetPublicKeys) {
    this.publicKeyGetter = publicKeyGetter
  }

  decode (urlEncodedJwt: string): Jwt {
    const [header, payload, signature] = urlEncodedJwt.split('.')
    const result: Jwt = {
      header: JSON.parse(jwtUtils.base64DecodeToString(header)),
      payload: JSON.parse(jwtUtils.base64DecodeToString(payload)),
      signature: signature
    }
    return result
  }
}
