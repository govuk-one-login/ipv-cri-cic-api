import { Jwks, Jwk } from "../../IVeriCredential";
import { v2KmsClient } from "../kmsClient";
import { Buffer } from "buffer";
import { IGetPublicKeys } from "../PublicKeyGetter";
import crypto from "node:crypto";

export class KmsJwksAdapter implements IGetPublicKeys {
	async getPublicKey(keyId: string): Promise<Jwk | null> {
		const kmsKey = await v2KmsClient.getPublicKey({ KeyId: keyId }).promise();
		const map = this.getKeySpecMap(kmsKey?.KeySpec);
		if (
			kmsKey != null &&
      map != null &&
      kmsKey.KeyId != null &&
      kmsKey.PublicKey != null
		) {
			const use = kmsKey.KeyUsage === "ENCRYPT_DECRYPT" ? "enc" : "sig";
			const publicKey = crypto
				.createPublicKey({
					key: kmsKey.PublicKey as Buffer,
					type: "spki",
					format: "der",
				})
				.export({ format: "jwk" });
			return {
				...publicKey,
				use,
				kid: keyId.split("/").pop(),
				alg: map.algorithm,
			} as unknown as Jwk;
		}
		return null;
	}

	async getJwks(): Promise<Jwks> { throw new Error("not implemented"); }

	getKeySpecMap(spec?: string): { keySpec: string; algorithm: Algorithm } | undefined {
		if (spec == null) return undefined;
		const conversions = [
			{
				keySpec: "ECC_NIST_P256",
				algorithm: "ES256" as unknown as Algorithm,
			},
			{
				keySpec: "RSA_2048",
				algorithm: "RS256" as unknown as Algorithm,
			},
		];
		return conversions.find(x => x.keySpec === spec);
	}
}
