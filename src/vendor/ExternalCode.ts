const DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS = 600;
const AUTHORIZATION_CODE_TTL  = process.env.AUTHORIZATION_CODE_TTL;
export class ExternalCode {

	getAuthorizationCodeExpirationEpoch(): number {

		//TO FIX  lint
		//const envAuthCodeTtl = parseInt(AUTHORIZATION_CODE_TTL || "", 10);
		//const authorizationCodeTtlInMillis = (Number.isInteger(envAuthCodeTtl) ? envAuthCodeTtl : DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS) * 1000;
		const authorizationCodeTtlInMillis =  DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS * 1000;

		// TODO: consider if this should be output in epoch seconds rather than milliseconds
		// so that it is consistent with the java implementation
		return Date.now() + authorizationCodeTtlInMillis;
	}
}
