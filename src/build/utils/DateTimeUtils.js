"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthorizationCodeExpirationEpoch = exports.absoluteTimeNow = void 0;
/**
 * Unix timestamp in seconds
 * The unix timestamp represents seconds elapsed since 01/01/1970
 *
 * @return Example output: 1657099344
 */
function absoluteTimeNow() {
    return Math.floor(Date.now() / 1000);
}
exports.absoluteTimeNow = absoluteTimeNow;
const DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS = 600;
function getAuthorizationCodeExpirationEpoch(authCodeTtl) {
    let authorizationCodeTtlInMillis;
    if (authCodeTtl) {
        const authCodeTtlNo = Number(authCodeTtl);
        authorizationCodeTtlInMillis = (Number.isInteger(authCodeTtlNo) ? authCodeTtlNo : DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS) * 1000;
    }
    else {
        authorizationCodeTtlInMillis = DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS * 1000;
    }
    return Date.now() + authorizationCodeTtlInMillis;
}
exports.getAuthorizationCodeExpirationEpoch = getAuthorizationCodeExpirationEpoch;
