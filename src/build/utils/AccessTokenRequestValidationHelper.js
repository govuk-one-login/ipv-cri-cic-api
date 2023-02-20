"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessTokenRequestValidationHelper = void 0;
const AppError_1 = require("./AppError");
const HttpCodesEnum_1 = require("./HttpCodesEnum");
const Constants_1 = require("./Constants");
const ValidationHelper_1 = require("./ValidationHelper");
const AuthSessionState_1 = require("../models/enums/AuthSessionState");
class AccessTokenRequestValidationHelper {
    constructor() {
        this.validationHelper = new ValidationHelper_1.ValidationHelper();
    }
    validatePayload(tokenRequestBody) {
        if (!tokenRequestBody)
            throw new AppError_1.AppError("Invalid request: missing body", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        // body is an application/x-www-form-urlencoded string
        const searchParams = new URLSearchParams(tokenRequestBody);
        const code = searchParams.get(Constants_1.Constants.CODE);
        const redirectUri = searchParams.get(Constants_1.Constants.REDIRECT_URL);
        const grant_type = searchParams.get(Constants_1.Constants.GRANT_TYPE);
        if (!redirectUri)
            throw new AppError_1.AppError("Invalid request: Missing redirect_uri parameter", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        if (!code)
            throw new AppError_1.AppError("Invalid request: Missing code parameter", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        if (!grant_type || grant_type !== Constants_1.Constants.AUTHORIZATION_CODE) {
            throw new AppError_1.AppError("Invalid grant_type parameter", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        if (!this.validationHelper.isValidUUID(code)) {
            throw new AppError_1.AppError("AuthorizationCode must be a valid uuid", HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        return { grant_type, code, redirectUri };
    }
    validateTokenRequestToRecord(sessionItem, redirectUri) {
        // Validate the redirectUri
        const isValidRedirectUri = redirectUri.includes("/")
            ? redirectUri === sessionItem.redirectUri
            : redirectUri === encodeURIComponent(sessionItem.redirectUri);
        if (!isValidRedirectUri) {
            throw new AppError_1.AppError(`Invalid request: redirect uri ${redirectUri} does not match configuration uri ${sessionItem.redirectUri}`, HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
        // Validate if the AuthSessionState is CIC_AUTH_CODE_ISSUED
        if (sessionItem.authSessionState !== AuthSessionState_1.AuthSessionState.CIC_AUTH_CODE_ISSUED) {
            throw new AppError_1.AppError(`AuthSession is in wrong Auth state: Expected state- ${AuthSessionState_1.AuthSessionState.CIC_AUTH_CODE_ISSUED}, actual state- ${sessionItem.authSessionState}`, HttpCodesEnum_1.HttpCodesEnum.UNAUTHORIZED);
        }
    }
}
exports.AccessTokenRequestValidationHelper = AccessTokenRequestValidationHelper;
