import crypto from "crypto";
import { jwtUtils } from "../../JwtUtils";
import { IEncryptSymmetric } from "../interfaces/IEncryptSymmetric";

export class GcmEncryptor implements IEncryptSymmetric {
	async encrypt(input: string, key: Uint8Array, iv: Uint8Array, additionalData: Uint8Array): Promise<Uint8Array> {
		const webcrypto = crypto.webcrypto as unknown as Crypto;

		const encoded = jwtUtils.encode(input);
		const cryptoKey = await webcrypto.subtle.importKey("raw", key, "AES-GCM", true, ["encrypt", "decrypt"]);
		const ciphertext = await webcrypto.subtle.encrypt(
			{
				name: "AES-GCM",
				iv,
				additionalData,
				tagLength: 128,
			},
			cryptoKey,
			encoded,
		);

		return new Uint8Array(ciphertext);
	}
}
