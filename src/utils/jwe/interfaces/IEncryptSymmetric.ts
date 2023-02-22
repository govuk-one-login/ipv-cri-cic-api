export interface IEncryptSymmetric {
  encrypt: (input: string, key: Uint8Array, iv: Uint8Array, additionalData: Uint8Array) => Promise<Uint8Array>
}
