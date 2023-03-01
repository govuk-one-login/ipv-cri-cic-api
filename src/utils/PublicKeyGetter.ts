import { Jwk, Jwks } from '../types/Auth'
import https from 'https'

export interface IGetPublicKeys {
  getJwks: () => Promise<Jwks>
}

export class JwksPublicKeyGetter implements IGetPublicKeys {
  private readonly endpoint: URL

  constructor (endpoint: URL) {
    this.endpoint = endpoint
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
