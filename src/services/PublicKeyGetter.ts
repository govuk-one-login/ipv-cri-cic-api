import { v3KmsClient } from './aws/kmsClient'
import { GetPublicKeyCommand, GetPublicKeyCommandOutput } from '@aws-sdk/client-kms'
import { Jwk, Jwks } from '../types/Auth'
import https from 'https'

export interface IGetPublicKeys {
  getPublicKey: (keyId: string) => Promise<any>
  getJwks: () => Promise<Jwks>
}

// Deprecated
export class KmsPublicKeyGetter implements IGetPublicKeys {
  async getPublicKey (keyId: string): Promise<Uint8Array> {
    const output: GetPublicKeyCommandOutput = await v3KmsClient.send(
      new GetPublicKeyCommand({
        KeyId: keyId
      })
    )

    const publicKey = output.PublicKey ?? null
    if (publicKey === null) {
      throw new Error('No PublicKey received when calling KMS to get the Public Key')
    }

    return publicKey
  }

  async getJwks (): Promise<Jwks> {
    throw new Error('Not implemented')
  }
}

export class JwksPublicKeyGetter implements IGetPublicKeys {
  private readonly endpoint: URL

  constructor (endpoint: URL) {
    this.endpoint = endpoint
  }

  async getPublicKey (keyId: string): Promise<Jwk> {
    const JWKS: Jwks = await this.getJwks()
    const jsonWebKey = JWKS.keys.find((key) => key.kid === keyId) ?? null
    if (jsonWebKey === null) throw Error('Json Web Key Set did not include the given kid')
    return jsonWebKey
  }

  async getJwks (): Promise<Jwks> {
    const endpoint = this.endpoint ?? null
    if (endpoint == null) {
      throw Error('No JWKS endpoint provided')
    }
    const options = {
      hostname: endpoint.hostname,
      port: 443,
      method: 'GET',
      path: endpoint.pathname,
      headers: {
        'User-Agent': 'DcaCri/1.0.0'
      }
    }
    return await new Promise((resolve, reject) => {
      const req = https.get(options, res => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Could not retrieve public signing key from JWKS endpoint, received status: ${res.statusCode?.toString() ?? 'None'}, headers: ${JSON.stringify(res.headers)}`))
        }

        let output: Buffer = Buffer.from('')
        res.on('data', data => {
          output = Buffer.concat([output, data])
        })

        res.on('end', () => {
          const response = JSON.parse(output.toString())
          return resolve(response)
        })
      })
      req.end()
    })
  }
}
