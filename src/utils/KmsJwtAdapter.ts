import format from "ecdsa-sig-formatter";
import { Buffer } from "buffer";
import { Jwt, JwtHeader, JwtPayload, JsonWebTokenError, Jwk } from "./IVeriCredential";
import { jwtUtils } from "./JwtUtils";
import { DecryptCommand, DecryptCommandInput, DecryptCommandOutput, MessageType, SigningAlgorithmSpec } from "@aws-sdk/client-kms";
import crypto from "crypto";
import { importJWK, JWTPayload, jwtVerify } from "jose";
import axios from "axios";
import { createKmsClient } from "./KMSClient";
import * as AWS from "@aws-sdk/client-kms";
import { Logger } from "@aws-lambda-powertools/logger";
import { Constants } from "../utils/Constants";

export class KmsJwtAdapter {
    readonly kid: string;

    readonly kms: AWS.KMS;

	private cachedJwks: any;

	private cachedTime: Date | undefined;

	private readonly logger: Logger;

    constructor(kid: string, logger: Logger) {
    	this.kid = kid;
    	this.kms = createKmsClient();
		this.logger = logger;
    }

	getCachedDataForTest() {
        return {
            cachedJwks: this.cachedJwks,
            cachedTime: this.cachedTime,
        };
    }

	setCachedDataForTest(cachedJwks: any, cachedTime: Date) {
        this.cachedJwks = cachedJwks
		this.cachedTime = cachedTime
    }
	
    async sign(jwtPayload: JwtPayload, dnsSuffix: string): Promise<string> {
    	const jwtHeader: JwtHeader = { alg: "ES256", typ: "JWT" };
    	const kid = this.kid.split("/").pop();
    	if (kid != null) {
    		jwtHeader.kid = process.env.USE_MOCKED === "true" ? kid : (`did:web:${dnsSuffix}#${jwtUtils.getHashedKid(kid)}`);
    	}
    	const tokenComponents = {
    		header: jwtUtils.base64Encode(JSON.stringify(jwtHeader)),
    		payload: jwtUtils.base64Encode(JSON.stringify(jwtPayload)),
    		signature: "",
    	};
    	const params = {
    		Message: Buffer.from(`${tokenComponents.header}.${tokenComponents.payload}`),
    		KeyId: this.kid,
    		SigningAlgorithm: SigningAlgorithmSpec.ECDSA_SHA_256,
    		MessageType: MessageType.RAW,
    	};
    	const res = await this.kms.sign(params);
    	if (res.Signature == null) {
    		throw new Error("Failed to sign Jwt");
    	}
    	tokenComponents.signature = format.derToJose(Buffer.from(res.Signature).toString("base64"), "ES256");
    	return `${tokenComponents.header}.${tokenComponents.payload}.${tokenComponents.signature}`;
    }

    async verify(urlEncodedJwt: string): Promise<boolean> {
    	const [header, payload, signature] = urlEncodedJwt.split(".");
    	const message = Buffer.from(`${header}.${payload}`);
    	try {
    		const derSignature = format.joseToDer(signature, "ES256");
    		const result = await this.kms.verify({
    			KeyId: this.kid,
    			Message: message,
    			MessageType: MessageType.RAW,
    			Signature: derSignature,
    			SigningAlgorithm: AWS.SigningAlgorithmSpec.ECDSA_SHA_256,
    		});
    		return result.SignatureValid ?? false;
    	} catch (error) {
    		throw new Error("Failed to verify signature: " + error);
    	}
    }

    async verifyWithJwks(urlEncodedJwt: string, publicKeyEndpoint: string, targetKid?: string): Promise<JWTPayload | null> {
		if (!this.cachedJwks || (this.cachedTime && new Date() > this.cachedTime)) {
			this.logger.info("No cached keys found or cache time has expired");
    		const oidcProviderJwks = (await axios.get(publicKeyEndpoint));
			this.cachedJwks = oidcProviderJwks.data.keys;
			const cacheControl = oidcProviderJwks.headers['cache-control'];

			// If header is missing or doesn't match the expected format, maxAgeMatch will be null, and we set cache time to default value of 300 (5 minutes)
			const maxAge = cacheControl ? parseInt(cacheControl.match(/max-age=(\d+)/)?.[1], 10) || 300 : 300;
			this.cachedTime = new Date(Date.now() + (maxAge * 1000));
		}
    	let signingKey = this.cachedJwks.find((key: Jwk)=> key.kid === targetKid);

		if (!signingKey) {
			throw new Error(`No key found with kid '${targetKid}'`);
		}
    	const publicKey = await importJWK(signingKey, signingKey.alg);

		if (process.env.USE_MOCKED === "true") { //JWT verification is mocked for contract tests
			return {
				payload: { 
					data: "mockPayloadClaims" 
				}
			}
		} else { 
			try {
				const { payload } = await jwtVerify(urlEncodedJwt, publicKey);
				return payload;
			} catch (error) {
				throw new Error("Failed to verify signature: " + error);
			}
		}
    }

    decode(urlEncodedJwt: string): Jwt {
    	const [header, payload, signature] = urlEncodedJwt.split(".");

    	const result: Jwt = {
    		header: JSON.parse(jwtUtils.base64DecodeToString(header)),
    		payload: JSON.parse(jwtUtils.base64DecodeToString(payload)),
    		signature,
    	};
    	return result;
    }

    async decrypt(serializedJwe: string): Promise<string> {
    	const jweComponents = serializedJwe.split(".");

    	if (jweComponents.length !== 5) {
    		throw new JsonWebTokenError("Error decrypting JWE: Missing component");
    	}

    	const [
    		protectedHeader,
    		encryptedKey,
    		iv,
    		ciphertext,
    		tag,
    	] = jweComponents;

    	let cek: Uint8Array | undefined;
		try {
			if (process.env.KEY_ROTATION_ENABLED === "true") {
				for (const alias of Constants.ENCRYPTION_KEY_ALIASES) {
					try {
						const decryptCommand = new DecryptCommand(this.buildDecryptRequest(`alias/${alias}`, encryptedKey));
						this.logger.info(`Attempting decryption with key alias: ${alias}`)
						const output: DecryptCommandOutput = await this.kms.send(decryptCommand);
						if (output.Plaintext) {
							this.logger.info(`Decryption succesfull with key alias: ${alias}`)
							cek = output.Plaintext;
							break; 
						}
					} catch (error) {
						// Continue to the next alias; don't throw error
      				}
				}
			} else {
				const encryptionKeyId = process.env.ENCRYPTION_KEY_IDS;
				if (!encryptionKeyId) {
					throw new Error("Missing environment variable: ENCRYPTION_KEY_IDS");
				}
				const decryptCommand = new DecryptCommand(this.buildDecryptRequest(encryptionKeyId, encryptedKey));
				const output: DecryptCommandOutput = await this.kms.send(decryptCommand);
				cek = output.Plaintext;
			}

			if (cek === undefined) {
				throw new Error("No Plaintext received when calling KMS to decrypt the Encryption Key");
			}
		} catch (err) {
			throw new JsonWebTokenError("Error decrypting JWE: Unable to decrypt encryption key via KMS", err);
		}

    	let payload: Uint8Array;
    	try {
    		const webcrypto = crypto.webcrypto as unknown as Crypto;
    		const cek1 = await webcrypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
    		const decryptedBuffer = await webcrypto.subtle.decrypt(
    			{
    				name: "AES-GCM",
    				iv: jwtUtils.base64DecodeToUint8Array(iv),
    				additionalData: new Uint8Array(Buffer.from(protectedHeader)),
    				tagLength: 128,
    			},
    			cek1,
    			Buffer.concat([
    				new Uint8Array(jwtUtils.base64DecodeToUint8Array(ciphertext)),
    				new Uint8Array(jwtUtils.base64DecodeToUint8Array(tag)),
    			]),
    		);

    		payload = new Uint8Array(decryptedBuffer);
    	} catch (err) {
    		throw new JsonWebTokenError("Error decrypting JWE: Unable to decrypt payload via Crypto", err);
    	}

    	try {
    		return jwtUtils.decode(payload);
    	} catch (err) {
    		throw new JsonWebTokenError("Error decrypting JWE: Unable to decode the decrypted payload", err);
    	}
  	}

	buildDecryptRequest(keyIdentifier: string, encryptedKey: string): DecryptCommandInput {
		const inputs: DecryptCommandInput = {
			CiphertextBlob: jwtUtils.base64DecodeToUint8Array(encryptedKey),
			EncryptionAlgorithm: "RSAES_OAEP_SHA_256",
			KeyId: keyIdentifier,
		}
		return inputs;
	}
}
