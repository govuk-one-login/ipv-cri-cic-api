"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationHelper = void 0;
const class_validator_1 = require("class-validator");
const AppError_1 = require("./AppError");
const HttpCodesEnum_1 = require("./HttpCodesEnum");
const DateTimeUtils_1 = require("./DateTimeUtils");
const Constants_1 = require("./Constants");
class ValidationHelper {
    constructor() {
        this.isJwtComplete = (payload) => {
            const clientId = payload.client_id;
            const responseType = payload.response_type;
            const journeyId = payload.govuk_signin_journey_id;
            const { iss, sub, aud, exp, nbf, state } = payload;
            const mandatoryJwtValues = [iss, sub, aud, exp, nbf, state, clientId, responseType, journeyId];
            return !mandatoryJwtValues.some((value) => value === undefined);
        };
        this.isJwtValid = (jwtPayload, requestBodyClientId, expectedRedirectUri) => {
            if (!this.isJwtComplete(jwtPayload)) {
                return "JWT validation/verification failed: Missing mandatory fields in JWT payload";
            }
            else if ((jwtPayload.exp == null) || ((0, DateTimeUtils_1.absoluteTimeNow)() > jwtPayload.exp)) {
                return "JWT validation/verification failed: JWT expired";
            }
            else if (jwtPayload.nbf == null || ((0, DateTimeUtils_1.absoluteTimeNow)() < jwtPayload.nbf)) {
                return "JWT validation/verification failed: JWT not yet valid";
            }
            else if (jwtPayload.client_id !== requestBodyClientId) {
                return `JWT validation/verification failed: Mismatched client_id in request body (${requestBodyClientId}) & jwt (${jwtPayload.client_id})`;
            }
            else if (jwtPayload.response_type !== "code") {
                return `JWT validation/verification failed: Unable to retrieve redirect URI for client_id: ${requestBodyClientId}`;
            }
            else if (expectedRedirectUri !== jwtPayload.redirect_uri) {
                return `JWT validation/verification failed: Redirect uri ${jwtPayload.redirect_uri} does not match configuration uri ${expectedRedirectUri}`;
            }
            return "";
        };
    }
    async validateModel(model, logger) {
        try {
            await (0, class_validator_1.validateOrReject)(model, { forbidUnknownValues: true });
        }
        catch (errors) {
            const errorDetails = this.getErrors(errors);
            console.log(`${model.constructor.name}`);
            console.log("**** Error validating " + `${model.constructor.name}` + "   " + JSON.stringify(errorDetails));
            console.log(`Failed to validate data - ${model.constructor.name}`, "ValidationHelper", HttpCodesEnum_1.HttpCodesEnum.UNPROCESSABLE_ENTITY, errorDetails);
            throw new AppError_1.AppError(`Failed to Validate - ${model.constructor.name}` + errorDetails, HttpCodesEnum_1.HttpCodesEnum.UNPROCESSABLE_ENTITY);
        }
    }
    getErrors(errors) {
        return errors.map((error) => {
            return {
                property: error.property,
                value: error.value,
                constraints: error.constraints,
                children: error?.children, // Gets error messages from nested Objects
            };
        });
    }
    validateUserData(data, errmsg, logger) {
        let isValid = true;
        if (data === null || data === undefined) {
            isValid = false;
        }
        else {
            if (typeof data === "string") {
                if (data.trim().length === 0) {
                    isValid = false;
                }
            }
            else {
                if (data.length === 0) {
                    isValid = false;
                }
            }
        }
        if (!isValid) {
            logger.info({ message: "UserInfo missing: ", errmsg });
        }
        return isValid;
    }
    validateUserInfo(session, logger) {
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
    async eventToSubjectIdentifier(jwtAdapter, event) {
        const headerValue = event.headers.authorization ?? event.headers.Authorization;
        if (headerValue === null || headerValue === undefined) {
            throw new AppError_1.AppError("Missing header: Authorization header value is missing or invalid auth_scheme", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        const authHeader = event.headers.Authorization;
        if (authHeader !== null && !authHeader.includes(Constants_1.Constants.BEARER)) {
            throw new AppError_1.AppError("Missing header: Authorization header is not of Bearer type access_token", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        const token = headerValue.replace(/^Bearer\s+/, "");
        let isValidJwt = false;
        try {
            isValidJwt = await jwtAdapter.verify(token);
        }
        catch (err) {
            throw new AppError_1.AppError("Failed to verify signature", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        if (!isValidJwt) {
            throw new AppError_1.AppError("Verification of JWT failed", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        const jwt = jwtAdapter.decode(token);
        if (jwt?.payload?.exp == null || jwt.payload.exp < (0, DateTimeUtils_1.absoluteTimeNow)()) {
            throw new AppError_1.AppError("Verification of exp failed", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        if (jwt?.payload?.sub == null) {
            throw new AppError_1.AppError("sub missing", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        return jwt.payload.sub;
    }
    isValidUUID(code) {
        return Constants_1.Constants.REGEX_UUID.test(code);
    }
}
exports.ValidationHelper = ValidationHelper;
