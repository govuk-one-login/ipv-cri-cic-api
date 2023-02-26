export interface IDecryptSymmetric {
	decrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array, tag: Uint8Array, additionalData: Uint8Array): Promise<Uint8Array>;
}
