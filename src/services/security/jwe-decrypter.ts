import { JsonWebTokenError } from "../../utils/IVeriCredential";
import { jwtUtils } from "../../utils/JwtUtils";
import * as jose from "node-jose";
import { fromEnv } from "@aws-sdk/credential-providers";
import { DecryptCommand, DecryptCommandInput, DecryptCommandOutput, KMSClient } from "@aws-sdk/client-kms";
import crypto from "crypto";

interface IDecryptAsymmetric {
	decrypt(cek: Uint8Array): Promise<Uint8Array>;
}

interface IDecryptSymmetric {
	decrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array, tag: Uint8Array, additionalData: Uint8Array): Promise<Uint8Array>;
}

interface IDecryptJwe {
	decrypt(serializedJwe: string): Promise<string>;
}


export class JweDecryptor implements IDecryptJwe {
  async decrypt(serializedJwe: string): Promise<string> {
    const kmsClient = new KMSClient({ region: process.env.REGION, credentials: fromEnv() });
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
            CiphertextBlob: new Uint8Array(jose.util.base64url.decode(encryptedKey)),
            EncryptionAlgorithm: "RSAES_OAEP_SHA_256",
            KeyId: process.env.ENCRYPTION_KEY_IDS,
        };
    
        const output: DecryptCommandOutput = await kmsClient.send(
            new DecryptCommand(inputs),
        );
    
        const plaintext = output.Plaintext ?? null;
    
        if (plaintext === null) {
            throw new Error("No Plaintext received when calling KMS to decrypt the Encryption Key");
        }
        cek = plaintext;
        console.log('cek', cek);
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
        console.log('payload', payload);
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
