import { RsaEncryptor } from "./adapters/RsaEncryptor";
import { GcmEncryptor } from "./adapters/GcmEncryptor";
import { JweEncryptor } from "./JweEncryptor";
import { KmsJwksAdapter } from "./adapters/KmsJwksAdapter";

export async function encrypt(jws: string) {

    const jweEncryptor = new JweEncryptor(
      new RsaEncryptor(new KmsJwksAdapter()),
      new GcmEncryptor()
    )

    return await jweEncryptor.encrypt(jws)
}

