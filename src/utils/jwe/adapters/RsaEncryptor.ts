import crypto from 'crypto'
import { IEncryptAsymmetric } from '../interfaces/IEncryptAsymmetric'
import { IGetPublicKeys } from '../../adapters/PublicKeyGetter'

export class RsaEncryptor implements IEncryptAsymmetric {
  private readonly publicKeyGetter

  constructor (publicKeyGetter: IGetPublicKeys) {
    this.publicKeyGetter = publicKeyGetter
  }

  async encrypt (cek: Uint8Array, keyId: string): Promise<Uint8Array> {
    const webcrypto = crypto.webcrypto as unknown as Crypto
    const publicKey = await this.publicKeyGetter.getPublicKey(keyId)
    const publicKeyAsCryptoKey: CryptoKey = await webcrypto.subtle.importKey('jwk', publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])

    const encryptedKey = await webcrypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      publicKeyAsCryptoKey,
      cek
    )

    return new Uint8Array(encryptedKey)
  }
}
