import * as jose from "jose";
import crypto from "crypto";

export const jwtUtils = {

	// convert non-base64 string or uint8array into base64 encoded string
	base64Encode(value: string | Uint8Array): string {
    	return jose.base64url.encode(value);
	},

	// convert base64 into uint8array
	base64DecodeToUint8Array(value: string): Uint8Array {
    	return jose.base64url.decode(value);
	},

	// convert base64 encoded string into non-base64 string
	base64DecodeToString(value: string): string {
    	return new TextDecoder().decode(jose.base64url.decode(value));
  	},

	// convert uint8array into string
	decode(value: Uint8Array): string {
		const decoder = new TextDecoder();
		return decoder.decode(value);
	},

	// convert string into uint8array
	encode(value: string): Uint8Array {
		const encoder = new TextEncoder();
		return encoder.encode(value);
	},

	// hash string then present output as UTF-8 encoded hexadecimal string
	getHashedKid(keyId: string): string {
		return crypto.createHash("sha256").update(keyId, "utf8").digest("hex");
	},
};
