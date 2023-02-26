export interface IDecryptJwe {
	decrypt(serializedJwe: string): Promise<string>;
}
