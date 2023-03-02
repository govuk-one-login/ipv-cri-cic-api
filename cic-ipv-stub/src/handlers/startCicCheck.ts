import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import AWS from 'aws-sdk'
import crypto from 'node:crypto'
import { util } from 'node-jose'
import format from 'ecdsa-sig-formatter'
import { JarPayload, Jwks, JwtHeader } from '../auth.types'
import axios from 'axios'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const config = getConfig(event.body)

  const webcrypto = crypto.webcrypto as unknown as Crypto
  const iat = Math.floor(Date.now() / 1000)
  const payload: JarPayload = {
    sub: crypto.randomUUID(),
    redirect_uri: config.redirectUri,
    response_type: 'code',
    govuk_signin_journey_id: crypto.randomBytes(5).toString('hex'),
    aud: config.oidcUri,
    iss: 'https://ipv.core.account.gov.uk',
    client_id: config.clientId,
    state: new TextDecoder().decode(webcrypto.getRandomValues(new Uint8Array(16))),
    iat,
    nbf: iat - 1,
    exp: iat + (3 * 60)
  }
  const signedJwt = await sign(payload, config.signingKey)

  const publicEncryptionKey: CryptoKey = await getPublicEncryptionKey(config)
  const request = await encrypt(signedJwt, publicEncryptionKey)

  return {
    statusCode: 201,
    body: JSON.stringify({
      request,
      responseType: 'code',
      clientId: config.clientId,
      AuthorizeLocation: `${config.oidcUri}/authorize?request=${request}&response_type=code&client_id=${config.clientId}`
    })
  }
}

export function getConfig (body: string | null): { redirectUri: string, jwksUri: string, clientId: string, signingKey: string, oidcUri: string } {
  if (process.env.REDIRECT_URI == null ||
        process.env.JWKS_URI == null ||
        process.env.CLIENT_ID == null ||
        process.env.SIGNING_KEY == null ||
        process.env.OIDC_FRONT_BASE_URI == null) {
    throw new Error('Missing configuration')
  }

  const requestBody = body !== null ? JSON.parse(body) : null

  return {
    redirectUri: process.env.REDIRECT_URI,
    jwksUri: process.env.JWKS_URI,
    clientId: process.env.CLIENT_ID,
    signingKey: process.env.SIGNING_KEY,
    oidcUri: requestBody?.target !== null ? requestBody.target : process.env.OIDC_FRONT_BASE_URI
  }
}

async function getPublicEncryptionKey (config: { oidcUri: string }): Promise<CryptoKey> {
  const webcrypto = crypto.webcrypto as unknown as Crypto
  const oidcProviderJwks = (await axios.get(`${config.oidcUri}/.well-known/jwks.json`)).data as Jwks
  const publicKey = oidcProviderJwks.keys.find(key => key.use === 'enc')
  const publicEncryptionKey: CryptoKey = await webcrypto.subtle.importKey('jwk', publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])
  return publicEncryptionKey
}

async function sign (payload: JarPayload, keyId: string): Promise<string> {
  const kid = keyId.split('/').pop() ?? ''
  const alg = 'ECDSA_SHA_256'
  const jwtHeader: JwtHeader = { alg: 'ES256', typ: 'JWT', kid }
  const tokenComponents = {
    header: util.base64url.encode(Buffer.from(JSON.stringify(jwtHeader)), 'utf8'),
    payload: util.base64url.encode(Buffer.from(JSON.stringify(payload)), 'utf8'),
    signature: ''
  }
  const v2KmsClient = new AWS.KMS({
    region: process.env.REGION ?? 'eu-west-2',
    httpOptions: { timeout: 29000, connectTimeout: 5000 },
    maxRetries: 2,
    retryDelayOptions: { base: 200 }
  })
  const res = await v2KmsClient.sign({
    Message: Buffer.from(`${tokenComponents.header}.${tokenComponents.payload}`),
    KeyId: kid,
    SigningAlgorithm: alg,
    MessageType: 'RAW'
  }).promise()
  if (res?.Signature == null) {
    throw res as unknown as AWS.AWSError
  }
  tokenComponents.signature = format.derToJose(res.Signature.toString('base64url'), 'ES256')
  return `${tokenComponents.header}.${tokenComponents.payload}.${tokenComponents.signature}`
}

async function encrypt (plaintext: string, publicEncryptionKey: CryptoKey): Promise<string> {
  const webcrypto = crypto.webcrypto as unknown as Crypto
  const initialisationVector = webcrypto.getRandomValues(new Uint8Array(12))
  const header = {
    alg: 'RSA-OAEP-256',
    enc: 'A256GCM'
  }
  const protectedHeader: string = util.base64url.encode(Buffer.from(JSON.stringify(header)), 'utf8')
  const aesParams: AesGcmParams = {
    additionalData: new Uint8Array(Buffer.from(protectedHeader)),
    iv: initialisationVector,
    tagLength: 128,
    name: 'AES-GCM'
  }
  const cek: Uint8Array = webcrypto.getRandomValues(new Uint8Array(32))
  // asymmetric encryption
  const encryptedKey: ArrayBuffer = await webcrypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    publicEncryptionKey,
    cek
  )
  // Symmetric encryption
  const encoded: Uint8Array = new TextEncoder().encode(plaintext)
  const cryptoKey = await webcrypto.subtle.importKey('raw', cek, 'AES-GCM', true, ['encrypt', 'decrypt'])
  const encrypted: Uint8Array = new Uint8Array(await webcrypto.subtle.encrypt(
    aesParams,
    cryptoKey,
    encoded
  ))

  const tag: Uint8Array = encrypted.slice(-16)
  const ciphertext: Uint8Array = encrypted.slice(0, -16)

  return `${protectedHeader}.` +
        `${util.base64url.encode(Buffer.from((new Uint8Array(encryptedKey))))}.` +
        `${util.base64url.encode(Buffer.from(new Uint8Array(initialisationVector)))}.` +
        `${util.base64url.encode(Buffer.from(ciphertext))}.` +
        `${util.base64url.encode(Buffer.from(tag))}`
}
