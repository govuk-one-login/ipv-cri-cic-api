import { KmsJwtAdapter } from "../KmsJwtAdapter"
import { JwtPayload, kid } from "../IVeriCredential"

export async function sign (jwtPayload: JwtPayload, kid?: kid) {
  const jwtSigner = new KmsJwtAdapter(kid ?? '')
  return await jwtSigner.sign(jwtPayload)
}
