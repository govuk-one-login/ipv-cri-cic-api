import { RsaEncryptor } from "./RsaEncryptor";
import { GcmEncryptor } from "./GcmEncryptor";
import { JweEncryptor } from "../JweEncryptor";
import { KmsJwksAdapter } from "./KmsJwksAdapter";

export async function encrypt(jws: string) {

	const jweEncryptor = new JweEncryptor(
		new RsaEncryptor(new KmsJwksAdapter()),
		new GcmEncryptor(),
	);

	return jweEncryptor.encrypt(jws);
}

