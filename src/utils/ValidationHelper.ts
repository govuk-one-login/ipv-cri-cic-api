import { validateOrReject } from "class-validator";
import { AppError } from "./AppError";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "./HttpCodesEnum";
import { ISessionItem } from "../models/ISessionItem";
import { KmsJwtAdapter } from "./KmsJwtAdapter";
import { APIGatewayProxyEvent } from "aws-lambda";
import { absoluteTimeNow } from "./DateTimeUtils";
import { Constants } from "./Constants";
import { JwtPayload } from "./IVeriCredential";

export class ValidationHelper {

	async validateModel(model: object, logger: Logger): Promise<void> {
		try {
			await validateOrReject(model, { forbidUnknownValues: true });
		} catch (errors) {
			const errorDetails = this.getErrors(errors);
			console.log(`${model.constructor.name}`);
			console.log("**** Error validating " + `${model.constructor.name}` + "   " + JSON.stringify(errorDetails));
			console.log(`Failed to validate data - ${model.constructor.name}`, "ValidationHelper", HttpCodesEnum.UNPROCESSABLE_ENTITY, errorDetails);
			throw new AppError(`Failed to Validate - ${model.constructor.name}` + errorDetails, HttpCodesEnum.UNPROCESSABLE_ENTITY);
		}
	}

	private getErrors(errors: any): any {
		return errors.map((error: any) => {
			return {
				property: error.property,
				value: error.value,
				constraints: error.constraints,
				children: error?.children, // Gets error messages from nested Objects
			};
		});
	}

	private validateUserData(data: string | undefined | string[], errmsg: string, logger: Logger): boolean {
		let isValid = true;
		if (data === null || data === undefined ) {
			isValid = false;
		} else {
			if (typeof data === "string") {
				if (data.trim().length === 0) {
					isValid = false;
				}
			} else {
				if (data.length === 0) {
					isValid = false;
				}
			}
		}
		if (!isValid) {
			logger.info({ message :"UserInfo missing: ", errmsg });
		}
		return isValid;
	}

	validateUserInfo(session: ISessionItem, logger: Logger): boolean {
		let isValid = true;
		if (!this.validateUserData(session.given_names, "Given names is missing", logger) ||
			!this.validateUserData(session.family_names, "Family names is missing", logger) ||
			!this.validateUserData(session.date_of_birth, "Date of Birth is missing", logger) ||
			!this.validateUserData(session.document_selected, "Document selection type is missing", logger) ||
			!this.validateUserData(session.date_of_expiry, "Expiry Date is missing", logger)) {
			isValid = false;
		}
		return isValid;
	}

	async eventToSubjectIdentifier(jwtAdapter: KmsJwtAdapter, event: APIGatewayProxyEvent): Promise<string> {
		const headerValue = event.headers.authorization ?? event.headers.Authorization;
		if (headerValue === null || headerValue === undefined) {
			throw new AppError( "Missing header: Authorization header value is missing or invalid auth_scheme", HttpCodesEnum.UNAUTHORIZED);
		}
		const authHeader = event.headers.Authorization as string;
		if (authHeader !== null && !authHeader.includes(Constants.BEARER)) {
			throw new AppError( "Missing header: Authorization header is not of Bearer type access_token", HttpCodesEnum.UNAUTHORIZED);

		}
		const token = headerValue.replace(/^Bearer\s+/, "");
		let isValidJwt = false;
		try {
			isValidJwt = await jwtAdapter.verify(token);
		} catch (err) {
			throw new AppError( "Failed to verify signature", HttpCodesEnum.UNAUTHORIZED);
		}

		if (!isValidJwt) {
			throw new AppError("Verification of JWT failed", HttpCodesEnum.UNAUTHORIZED);
		}

		const jwt = jwtAdapter.decode(token);

		if (jwt?.payload?.exp == null || jwt.payload.exp < absoluteTimeNow()) {
			throw new AppError("Verification of exp failed", HttpCodesEnum.UNAUTHORIZED);
		}

		if (jwt?.payload?.sub == null) {
			throw new AppError( "sub missing", HttpCodesEnum.UNAUTHORIZED);
		}

		return jwt.payload.sub;
	}

	isValidUUID(code: string): boolean {
		return Constants.REGEX_UUID.test(code);
	}

	isJwtComplete = (payload: JwtPayload): boolean => {
		const clientId = payload.client_id;
		const responseType = payload.response_type;
		const journeyId = payload.govuk_signin_journey_id;
		const { iss, sub, aud, exp, nbf, state } = payload;
		const mandatoryJwtValues = [iss, sub, aud, exp, nbf, state, clientId, responseType, journeyId];
		return !mandatoryJwtValues.some((value) => value === undefined);
	};

	isJwtValid = (jwtPayload: JwtPayload,
		requestBodyClientId: string, expectedRedirectUri: string): string => {

		if (!this.isJwtComplete(jwtPayload)) {
			return "JWT validation/verification failed: Missing mandatory fields in JWT payload";
		} else if ((jwtPayload.exp == null) || (absoluteTimeNow() > jwtPayload.exp)) {
			return "JWT validation/verification failed: JWT expired";
		} else if (jwtPayload.nbf == null || (absoluteTimeNow() < jwtPayload.nbf)) {
			return "JWT validation/verification failed: JWT not yet valid";
		} else if (jwtPayload.client_id !== requestBodyClientId) {
			return `JWT validation/verification failed: Mismatched client_id in request body (${requestBodyClientId}) & jwt (${jwtPayload.client_id})`;
		} else if (jwtPayload.response_type !== "code") {
			return `JWT validation/verification failed: Unable to retrieve redirect URI for client_id: ${requestBodyClientId}`;
		} else if (expectedRedirectUri !== jwtPayload.redirect_uri) {
			return `JWT validation/verification failed: Redirect uri ${jwtPayload.redirect_uri} does not match configuration uri ${expectedRedirectUri}`;
		} 

		return "";
	};
}
