import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
} from "@aws-sdk/client-kms";
import crypto from "node:crypto";
import { util } from "node-jose";
import format from "ecdsa-sig-formatter";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { JWTPayload, Jwks, JwtHeader } from "../auth.types";
import axios from "axios";
import { getHashedKid } from "../utils/hashing";
import { createPublicKey } from "node:crypto";

export const v3KmsClient = new KMSClient({
  region: process.env.REGION ?? "eu-west-2",
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 29000,
    socketTimeout: 29000,
  }),
  maxAttempts: 2,
});

let frontendURL: string;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const config = getConfig();
  const overrides = event.body !== null ? JSON.parse(event.body) : null;
  let addSharedClaims = true;
  if (overrides?.target != null) {
    config.backendUri = overrides.target;
  }
  if (overrides?.addSharedClaims != null) {
    addSharedClaims = overrides.addSharedClaims;
  }

  frontendURL =
    overrides?.frontendURL != null ? overrides.frontendURL : config.frontUri;

  const defaultClaims = {
    name: [
      {
        nameParts: [
          {
            value: "Frederick",
            type: "GivenName",
          },
          {
            value: "Joseph",
            type: "GivenName",
          },
          {
            value: "Flintstone",
            type: "FamilyName",
          },
        ],
      },
    ],
    birthDate: [
      {
        value: "1960-02-02",
      },
    ],
    email: "example@testemail.com",
  };

  const iat = Math.floor(Date.now() / 1000);
  let payload: JWTPayload = {
    sub: crypto.randomUUID(),
    redirect_uri: config.redirectUri,
    response_type: "code",
    govuk_signin_journey_id: crypto.randomBytes(16).toString("hex"),
    aud: frontendURL,
    iss: "https://ipv.core.account.gov.uk",
    client_id: config.clientId,
    state: crypto.randomBytes(16).toString("hex"),
    iat,
    nbf: iat - 1,
    exp: iat + 3 * 60,
    jti: crypto.randomBytes(16).toString("hex"),
  };

  if (overrides?.context != null) {
    payload = {
      ...payload,
      context: overrides.context,
    };
  }

  if (addSharedClaims) {
    payload.shared_claims =
      overrides?.shared_claims != null
        ? overrides.shared_claims
        : defaultClaims;
  }

  // Unhappy path testing enabled by optional flag provided in stub paylod
  let invalidKey;
  let missingEncryptionKey;
  if (overrides?.missingKid != null) {
    invalidKey = crypto.randomUUID();
  }
  if (overrides?.invalidKid != null) {
    invalidKey = config.additionalKey;
  }
  if (overrides?.missingEncryptionKey) {
    missingEncryptionKey = true;
  } else {
    missingEncryptionKey = false;
  }

  const signedJwt = await sign(payload, config.signingKey, invalidKey);
  const publicEncryptionKey: CryptoKey = await getPublicEncryptionKey(
    config,
    missingEncryptionKey
  );
  const request = await encrypt(signedJwt, publicEncryptionKey);

  return {
    statusCode: 200,
    body: JSON.stringify({
      request,
      responseType: "code",
      clientId: config.clientId,
      AuthorizeLocation: `${frontendURL}/oauth2/authorize?request=${request}&response_type=code&client_id=${config.clientId}`,
    }),
  };
};

export function getConfig(): {
  redirectUri: string;
  jwksUri: string;
  clientId: string;
  signingKey: string;
  additionalKey: string;
  uniqueEncryptionKey: string;
  frontUri: string;
  backendUri: string;
} {
  if (
    process.env.REDIRECT_URI == null ||
    process.env.JWKS_URI == null ||
    process.env.CLIENT_ID == null ||
    process.env.SIGNING_KEY == null ||
    process.env.OIDC_API_BASE_URI == null ||
    process.env.ADDITIONAL_KEY == null ||
    process.env.UNIQUE_ENCRYPTION_KEY == null ||
    process.env.OIDC_FRONT_BASE_URI == null
  ) {
    throw new Error("Missing configuration");
  }

  return {
    redirectUri: process.env.REDIRECT_URI,
    jwksUri: process.env.JWKS_URI,
    clientId: process.env.CLIENT_ID,
    signingKey: process.env.SIGNING_KEY,
    additionalKey: process.env.ADDITIONAL_KEY,
    uniqueEncryptionKey: process.env.UNIQUE_ENCRYPTION_KEY,
    frontUri: process.env.OIDC_FRONT_BASE_URI,
    backendUri: process.env.OIDC_API_BASE_URI,
  };
}

async function getPublicEncryptionKey(
  config: {
    backendUri: string;
    uniqueEncryptionKey: string;
  },
  missingEncryptionKey: boolean
): Promise<CryptoKey> {
  const webcrypto = crypto.webcrypto as unknown as Crypto;
  const oidcProviderJwks = (
    await axios.get(`${config.backendUri}/.well-known/jwks.json`)
  ).data as Jwks;
  let publicKey;
  if (missingEncryptionKey) {
    const uniqueEncryptionKeyId =
      config.uniqueEncryptionKey.split("/").pop() ?? "";
    publicKey = await getAsJwk(uniqueEncryptionKeyId);
  } else {
    publicKey = oidcProviderJwks.keys.find((key) => key.use === "enc");
    const kid = publicKey!.kid;
    const hashedKid = getHashedKid(kid);
    publicKey!.kid = hashedKid;
  }
  const publicEncryptionKey: CryptoKey = await webcrypto.subtle.importKey(
    "jwk",
    publicKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
  return publicEncryptionKey;
}

const getAsJwk = async (keyId: string): Promise<JsonWebKey | null> => {
  let publicSigningKey;
  try {
    publicSigningKey = await v3KmsClient.send(
      new GetPublicKeyCommand({ KeyId: keyId })
    );
  } catch (error) {
    console.warn("Failed to fetch key from KMS", { error });
  }
  const map = getKeySpecMap(publicSigningKey?.KeySpec);
  if (
    publicSigningKey != null &&
    map != null &&
    publicSigningKey.KeyId != null &&
    publicSigningKey.PublicKey != null
  ) {
    const use = publicSigningKey.KeyUsage === "ENCRYPT_DECRYPT" ? "enc" : "sig";
    const publicKey = createPublicKey({
      key: Buffer.from(publicSigningKey.PublicKey),
      type: "spki",
      format: "der",
    }).export({ format: "jwk" });
    const kid = keyId.split("/").pop()!;
    const hashedKid = getHashedKid(kid);
    return {
      ...publicKey,
      use,
      kid: hashedKid,
      alg: map.algorithm,
    } as unknown as JsonWebKey;
  }
  return null;
};

const getKeySpecMap = (
  spec?: string
): { keySpec: string; algorithm: string } | undefined => {
  if (spec == null) return undefined;
  const conversions = [
    {
      keySpec: "ECC_NIST_P256",
      algorithm: "ES256",
    },
    {
      keySpec: "RSA_2048",
      algorithm: "RS256",
    },
  ];
  return conversions.find((x) => x.keySpec === spec);
};

async function sign(
  payload: JWTPayload,
  keyId: string,
  invalidKeyId: string | undefined
): Promise<string> {
  const signingKid = keyId.split("/").pop() ?? "";
  const invalidKid = invalidKeyId?.split("/").pop() ?? "";
  // If an additional kid is provided to the function, return it in the header to create a mismatch - enable unhappy path testing
  const kid = invalidKeyId ? invalidKid : signingKid;
  const hashedKid = getHashedKid(kid);
  const alg = "ECDSA_SHA_256";
  const jwtHeader: JwtHeader = { alg: "ES256", typ: "JWT", kid: hashedKid };
  const tokenComponents = {
    header: util.base64url.encode(
      Buffer.from(JSON.stringify(jwtHeader)),
      "utf8"
    ),
    payload: util.base64url.encode(
      Buffer.from(JSON.stringify(payload)),
      "utf8"
    ),
    signature: "",
  };
  const res = await v3KmsClient.send(
    new SignCommand({
      // Key used to sign will always be default key
      KeyId: signingKid,
      SigningAlgorithm: alg,
      MessageType: "RAW",
      Message: Buffer.from(
        `${tokenComponents.header}.${tokenComponents.payload}`
      ),
    })
  );
  if (res?.Signature == null) {
    throw res as unknown as AWS.AWSError;
  }
  tokenComponents.signature = format.derToJose(
    Buffer.from(res.Signature),
    "ES256"
  );
  return `${tokenComponents.header}.${tokenComponents.payload}.${tokenComponents.signature}`;
}

async function encrypt(
  plaintext: string,
  publicEncryptionKey: CryptoKey
): Promise<string> {
  const webcrypto = crypto.webcrypto as unknown as Crypto;
  const initialisationVector = webcrypto.getRandomValues(new Uint8Array(12));
  const header = {
    alg: "RSA-OAEP-256",
    enc: "A256GCM",
  };
  const protectedHeader: string = util.base64url.encode(
    Buffer.from(JSON.stringify(header)),
    "utf8"
  );
  const aesParams: AesGcmParams = {
    additionalData: new Uint8Array(Buffer.from(protectedHeader)),
    iv: initialisationVector,
    tagLength: 128,
    name: "AES-GCM",
  };
  const cek: Uint8Array = webcrypto.getRandomValues(new Uint8Array(32));
  // asymmetric encryption
  const encryptedKey: ArrayBuffer = await webcrypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicEncryptionKey,
    cek
  );
  // Symmetric encryption
  const encoded: Uint8Array = new TextEncoder().encode(plaintext);
  const cryptoKey = await webcrypto.subtle.importKey(
    "raw",
    cek,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );
  const encrypted: Uint8Array = new Uint8Array(
    await webcrypto.subtle.encrypt(aesParams, cryptoKey, encoded)
  );

  const tag: Uint8Array = encrypted.slice(-16);
  const ciphertext: Uint8Array = encrypted.slice(0, -16);

  return (
    `${protectedHeader}.` +
    `${util.base64url.encode(Buffer.from(new Uint8Array(encryptedKey)))}.` +
    `${util.base64url.encode(
      Buffer.from(new Uint8Array(initialisationVector))
    )}.` +
    `${util.base64url.encode(Buffer.from(ciphertext))}.` +
    `${util.base64url.encode(Buffer.from(tag))}`
  );
}
