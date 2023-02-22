// limit to supported algs https://datatracker.ietf.org/doc/html/rfc7518
export type Algorithm =
  'HS256' | 'HS384' | 'HS512' |
  'RS256' | 'RS384' | 'RS512' |
  'ES256' | 'ES384' | 'ES512' |
  'PS256' | 'PS384' | 'PS512' |
  'none'

export interface JWKSBody {
  keys: Jwk[]
}
export interface Jwk extends JsonWebKey {
  alg: Algorithm
  kid: string
  kty: 'EC' | 'RSA'
  use: 'sig' | 'enc'
}

export interface Jwt {
  header: JwtHeader
  payload: JwtPayload
  signature: string
  jwk?: Jwk
}

export interface JwtHeader {
  alg: Algorithm | string
  typ?: string | undefined
  kid?: string
}

// standard claims https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
export interface JwtPayload {
  [key: string]: any
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number | undefined
  nbf?: number | undefined
  iat?: number | undefined
  jti?: string | undefined
}

export interface Jwks {
  keys: Jwk[]
}

/*
* Javascript Authorize request playload from https://www.rfc-editor.org/rfc/rfc9101.html
*/
export class JarPayload implements JwtPayload {
  redirect_uri?: string
  client_id?: string
  response_type?: 'code'
  scope?: string
  state?: string
  nonce?: string
}

export type kid = string

export class JsonWebTokenError extends Error {
  inner?: unknown

  constructor (message: string, error?: unknown) {
    super(message)
    this.inner = error
  };
}
