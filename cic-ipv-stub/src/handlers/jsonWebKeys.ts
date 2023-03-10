import { APIGatewayProxyResult } from 'aws-lambda'
import AWS from 'aws-sdk'
import { createPublicKey } from 'node:crypto'
import { JsonWebKey, Jwks } from '../auth.types'

export const v2KmsClient = new AWS.KMS({
  region: process.env.REGION ?? 'eu-west-2',
  httpOptions: { timeout: 29000, connectTimeout: 5000 },
  maxRetries: 2,
  retryDelayOptions: { base: 200 }
})

export function getConfig (): { signingKey: string | null } {
  return { signingKey: process.env.SIGNING_KEY ?? null }
}

const { signingKey } = getConfig()

export const handler = async (): Promise<APIGatewayProxyResult> => {
  const jwks: Jwks = {
    keys: []
  }
  if (signingKey != null) {
    const signingKeyId = signingKey.split('/').pop() ?? ''
    const formattedKey = await getAsJwk(signingKeyId)
    if (formattedKey != null) {
      jwks.keys.push(formattedKey)
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify(jwks)
  }
}

const getAsJwk = async (keyId: string): Promise<JsonWebKey | null> => {
  let publicSigningKey
  try {
    publicSigningKey = await v2KmsClient.getPublicKey({ KeyId: keyId }).promise()
  } catch (error) {
    console.warn('Failed to fetch key from KMS', { error })
  }

  const map = getKeySpecMap(publicSigningKey?.KeySpec)
  if (
    publicSigningKey != null &&
      map != null &&
      publicSigningKey.KeyId != null &&
      publicSigningKey.PublicKey != null
  ) {
    const use = publicSigningKey.KeyUsage === 'ENCRYPT_DECRYPT' ? 'enc' : 'sig'
    const publicKey = createPublicKey({
      key: publicSigningKey.PublicKey as Buffer,
      type: 'spki',
      format: 'der'
    })
      .export({ format: 'jwk' })
    return {
      ...publicKey,
      use,
      kid: keyId.split('/').pop(),
      alg: map.algorithm
    } as unknown as JsonWebKey
  }
  return null
}

const getKeySpecMap = (
  spec?: string
): { keySpec: string, algorithm: string } | undefined => {
  if (spec == null) return undefined
  const conversions = [
    {
      keySpec: 'ECC_NIST_P256',
      algorithm: 'ES256'
    },
    {
      keySpec: 'RSA_2048',
      algorithm: 'RS256'
    }
  ]
  return conversions.find(x => x.keySpec === spec)
}
