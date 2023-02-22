export interface IEncryptAsymmetric {
  encrypt: (cek: Uint8Array, keyId: string) => Promise<Uint8Array>
}
