export interface IDecryptAsymmetric {
  decrypt: (cek: Uint8Array) => Promise<Uint8Array>
}
