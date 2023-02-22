import { IEncryptAsymmetric } from './interfaces/IEncryptAsymmetric'
import { IEncryptSymmetric } from './interfaces/IEncryptSymmetric'
import crypto from 'crypto'
import { buildEncryptConfig } from '../config'
import { jwtUtils } from '../JwtUtils'

export class JweEncryptor {
  asymmetricEncryptor: IEncryptAsymmetric
  symmetricEncryptor: IEncryptSymmetric

  constructor (asymmetricEncryptor: IEncryptAsymmetric, symmetricEncryptor: IEncryptSymmetric) {
    this.asymmetricEncryptor = asymmetricEncryptor
    this.symmetricEncryptor = symmetricEncryptor
  }

  async encrypt (plaintext: string): Promise<string> {
    const webcrypto = crypto.webcrypto as unknown as Crypto
    const config = buildEncryptConfig()

    const header = {
      alg: 'RSA-OAEP-256',
      enc: 'A256GCM'
    }
    const protectedHeader: string = jwtUtils.base64Encode(JSON.stringify(header))
    const initializationVector: Uint8Array = webcrypto.getRandomValues(new Uint8Array(12))
    const cek: Uint8Array = webcrypto.getRandomValues(new Uint8Array(32))
    const additionalData: Uint8Array = new Uint8Array(Buffer.from(protectedHeader))

    const encryptedKey = await this.asymmetricEncryptor.encrypt(cek, config.ENCRYPTION_KEY_IDS)
    const encrypted: Uint8Array = await this.symmetricEncryptor.encrypt(plaintext, cek, initializationVector, additionalData)

    const tag: Uint8Array = encrypted.slice(-16)
    const ciphertext: Uint8Array = encrypted.slice(0, -16)

    return `${protectedHeader}.` +
      `${jwtUtils.base64Encode(encryptedKey)}.` +
      `${jwtUtils.base64Encode(initializationVector)}.` +
      `${jwtUtils.base64Encode(ciphertext)}.` +
      `${jwtUtils.base64Encode(tag)}`
  }
}
