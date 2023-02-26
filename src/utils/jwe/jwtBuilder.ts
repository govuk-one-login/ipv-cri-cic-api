import { absoluteTimeNow } from "../DateTimeUtils"
import { JwtPayload } from "../IVeriCredential"

export function buildJwt (client: any, overrides?: any ): JwtPayload {
  const now = absoluteTimeNow()-1
  const valid_jwt = {
    exp:1740608272,
    iat:1648562707,
    nbf:1648562707,
    aud:"https://f2f.cri.account.gov.uk/",
    iss:"https://ipv.core.account.gov.uk",
    sub:"urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    response_type:"code",
    client_id:"cd2cc8b5-304a-46e8-9b04-0e90438c18be",
    redirect_uri:"https://www.review-b.build.account.gov.uk/stub/callback",
    state:"af0ifjsldkj",
    govuk_signin_journey_id: "govuk_signin_journey_id",
    shared_claims:{
       name:[
          {
             nameParts:[
                {
                   value:"Frederick",
                   type:"GivenName"
                },
                {
                   value:"Joseph",
                   type:"GivenName"
                },
                {
                   value:"Flintstone",
                   type:"FamilyName"
                }
             ]
          }
       ],
       birthDate:[
          {
             value:"1960-02-02"
          }
       ]
    }
 }
  return { ...valid_jwt, ...overrides }
}
