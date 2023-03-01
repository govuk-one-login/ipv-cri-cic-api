import format from "ecdsa-sig-formatter";
import jose from 'node-jose'
import { Buffer } from "buffer";
import { Jwt, JwtHeader, JwtPayload, JsonWebTokenError } from "./IVeriCredential";
import * as AWS from "@aws-sdk/client-kms";
import { jwtUtils } from "./JwtUtils";
import { DecryptCommand, DecryptCommandInput, DecryptCommandOutput } from "@aws-sdk/client-kms";
import crypto from "crypto";
import { JwksPublicKeyGetter } from "./PublicKeyGetter";

export class KmsJwtAdapter {
    readonly kid: string;

    private kms = new AWS.KMS({
    	region: process.env.REGION,
    });

    /**
     * An implemention the JWS standard using KMS to sign Jwts
     *
     * kid: The key Id of the KMS key
     */
    ALG = "ECDSA_SHA_256";

    constructor(kid: string) {
    	this.kid = kid;
    }

    async sign(jwtPayload: JwtPayload): Promise<string> {
    	const jwtHeader: JwtHeader = { alg: "ES256", typ: "JWT" };
    	const kid = this.kid.split("/").pop();
    	if (kid != null) {
    		jwtHeader.kid = kid;
    	}
    	const tokenComponents = {
    		header: jwtUtils.base64Encode(JSON.stringify(jwtHeader)),
    		payload: jwtUtils.base64Encode(JSON.stringify(jwtPayload)),
    		signature: "",
    	};
    	const params = {
    		Message: Buffer.from(`${tokenComponents.header}.${tokenComponents.payload}`),
    		KeyId: this.kid,
    		SigningAlgorithm: this.ALG,
    		MessageType: "RAW",
    	};
    	const res = await this.kms.sign(params);
    	if (res.Signature == null) {
    		throw new Error("Failed to sign Jwt");
    	}
    	tokenComponents.signature = format.derToJose(Buffer.from(res.Signature).toString("base64"), "ES256");
    	return `${tokenComponents.header}.${tokenComponents.payload}.${tokenComponents.signature}`;
    }

    async verify(urlEncodedJwt: string, publicKeyEndpoint: string): Promise<boolean> {
			//TODO: Once we have .well-known endpoint and Infra work to allow Lambda to make external call
			//Replace hardcoded JWKS to instead fetch using the 'publickKeyEndpoint'
			// const publicKeyGetter = new JwksPublicKeyGetter(new URL(publicKeyEndpoint));
			// const JWKS: Jwks = await publicKeyGetter.getJwks()
			const JWKS: Jwks = ({
				"keys":[
					 {
							"kty":"EC",
							"use":"sig",
							"crv":"P-256",
							"x":"zltj6A3SFxlybEZ_yy1mfx7laW5y69wqhhSJOnKGKEA",
							"y":"UsxayS1k8aKRfSnJbtbvT3Jb4s5bPZ2TSI46uNoJRFQ",
							"alg":"ES256"
					 }
				]
		 });
			const keystore: jose.JWK.KeyStore = await new Promise((resolve, reject) => {
				jose.JWK.asKeyStore(JWKS)
					.then(result => resolve(result))
					.catch(err => reject(err))
			})
			try {
				const result = await new Promise((resolve, reject) => {
					jose.JWS.createVerify(keystore)
						.verify(urlEncodedJwt)
						.then(result => resolve(result))
						.catch(error => reject(error))
				})
				return result != null
			} catch (error) {
				console.error(error)
				return false
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

    async decrypt(serializedJwe: string): Promise<Uint8Array> {
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

    	let cek: Uint8Array;
    	try {
    		const inputs: DecryptCommandInput = {
    			CiphertextBlob: jwtUtils.base64DecodeToUint8Array(encryptedKey),
    			EncryptionAlgorithm: "RSAES_OAEP_SHA_256",
    			KeyId: process.env.ENCRYPTION_KEY_IDS,
    		};

    		const output: DecryptCommandOutput = await this.kms.send(
    			new DecryptCommand(inputs),
    		);
			
    		const plaintext = output.Plaintext ?? null;
			
    		if (plaintext === null) {
    			throw new Error("No Plaintext received when calling KMS to decrypt the Encryption Key");
    		}
    		cek = plaintext;
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
    			Buffer.concat([new Uint8Array(jwtUtils.base64DecodeToUint8Array(ciphertext)), new Uint8Array(jwtUtils.base64DecodeToUint8Array(tag))]),
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
}
