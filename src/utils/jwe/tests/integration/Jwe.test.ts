import { JweDecryptor } from "../../JweDecryptor";
import { RsaDecryptor } from "../../adapters/RsaDecryptor";
import { KmsJwksAdapter } from "../../../adapters/KmsJwksAdapter";
import { GcmDecryptor } from "../../adapters/GcmDecryptor";
import { JweEncryptor } from "../../JweEncryptor";
import { RsaEncryptor } from "../../adapters/RsaEncryptor";
import { GcmEncryptor } from "../../adapters/GcmEncryptor";
import { buildEncryptConfig } from "../../../config";
import { KmsJwtAdapter } from "../../../adapters/KmsJwtAdapter";
import { MockLogger } from '../../../tests/unit/adapters/MockLogger';

describe("JWE", () => {

  test("Builds a JWE and then decrypts it", async () => {

    const config = buildEncryptConfig()
    const logger = new MockLogger()
    const input = "Hello world"

    const jweEncryptor = new JweEncryptor(
      new RsaEncryptor(new KmsJwksAdapter()),
      new GcmEncryptor()
    )
    const serializedJwe = await jweEncryptor.encrypt(input)

    const jweDecryptor = new JweDecryptor(
      new RsaDecryptor(new KmsJwtAdapter(config.ENCRYPTION_KEY_IDS)),
      new GcmDecryptor()
    )
    const output = await jweDecryptor.decrypt(serializedJwe, logger)

    expect(output).toEqual(input)
  })
})