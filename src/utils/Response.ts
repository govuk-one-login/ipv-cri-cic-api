import { HttpCodesEnum } from "./HttpCodesEnum";
import { JwtPayload } from "./IVeriCredential";
export class Response {
	constructor(
		public statusCode: number,
		public body: string,
		public headers?: { [header: string]: boolean | number | string } | undefined,
		public multiValueHeaders?: { [header: string]: Array<boolean | number | string> } | undefined,
	) {}
}

export const SECURITY_HEADERS = {
	"Cache-Control": "no-store",
	"Content-Type": "application/json",
	"Strict-Transport-Security": "max-age=31536000",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
};

export const GenericServerError = {
	statusCode: HttpCodesEnum.SERVER_ERROR,
	headers: SECURITY_HEADERS,
	body: "Internal server error",
};

export const UnauthorizedResponse = (errorDescription: string) => {
	return {
		statusCode: HttpCodesEnum.UNAUTHORIZED,
		headers: SECURITY_HEADERS,
		body: JSON.stringify({
			redirect: null,
			message: errorDescription,
		}),
	};
};

export const UnauthorizedResponseWithRedirect = (params:
{
	errorDescription: string;
	error: string;
	jwtPayload: JwtPayload;
},
) => {
	const { error, errorDescription } = params;
	const redirectUri: string = params.jwtPayload?.redirect_uri ?? null;
	const state: string = params.jwtPayload?.state ?? null;
	if (redirectUri === null) {
		return GenericServerError;
	} else {
		return {
			statusCode: HttpCodesEnum.UNAUTHORIZED,
			headers: SECURITY_HEADERS,
			body: JSON.stringify({
				redirect: `${redirectUri}?error=${error}&error_description=${encodeURIComponent(errorDescription)}&state=${state}`,
				message: errorDescription,
			}),
		};
	}
};

//TODO: Include full name and DOB from shared_claims (Optional)
export const SuccessSessionResponse = (sessionId: string, state: string, redirect_uri: string) => {
	const responseBody = {
		session_id: sessionId,
		state,
		redirect_uri,
	};

	return {
		statusCode: HttpCodesEnum.OK,
		headers: SECURITY_HEADERS,
		body: JSON.stringify(responseBody),
	};
};
