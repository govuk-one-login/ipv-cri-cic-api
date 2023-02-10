export interface CredentialSubject {
	fullName: object[];
	dateOfBirth: string | undefined;
	documentType: string | undefined;
	dateOfExpiry: string | undefined;
}
export interface VerifiedCredential {
	"@context": string[];
	type: string[];
	credentialSubject: CredentialSubject;
}
export interface CredentialJwt {
	iat: number;
	iss: string;
	nbf: number;
	sub: string;
	aud: string;
	exp: number;
	vc: VerifiedCredential;
}
export interface JwtHeader {
	alg: Algorithm | string;
	typ?: string | undefined;
	kid?: string;
}
