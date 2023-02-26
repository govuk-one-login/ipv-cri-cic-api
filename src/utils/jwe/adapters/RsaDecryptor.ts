import { KmsJwtAdapter } from "../../KmsJwtAdapter";
import { IDecryptAsymmetric } from "../interfaces/IDecryptAsymmetric";

export class RsaDecryptor implements IDecryptAsymmetric {
  private readonly kmsJwsAdapter;

  constructor(kmsJwtAdapter: KmsJwtAdapter) {
  	this.kmsJwsAdapter = kmsJwtAdapter;
  }

  async decrypt(encryptedCek: Uint8Array): Promise<Uint8Array> {
  	return this.kmsJwsAdapter.decrypt(encryptedCek);
  }
}
