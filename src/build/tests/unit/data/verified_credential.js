"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_VC = void 0;
const Constants_1 = require("../../../utils/Constants");
exports.VALID_VC = {
    "iat": 1667385481,
    "iss": "https://XXX-c.env.account.gov.uk",
    "sub": "sub",
    "nbf": 1667385481,
    "jti": "uuid",
    "vc": {
        "@context": [
            Constants_1.Constants.W3_BASE_CONTEXT,
            Constants_1.Constants.DI_CONTEXT,
        ],
        "credentialSubject": {
            "name": [
                {
                    "nameParts": [
                        { "type": "GivenName", "value": "FRED" },
                        { "type": "GivenName", "value": "NICK" },
                        { "type": "FamilyName", "value": "OTHER" },
                        { "type": "FamilyName", "value": "NAME" },
                    ],
                },
            ],
            "birthDate": [{ "value": "01-01-1960" }],
        },
        "type": [Constants_1.Constants.VERIFIABLE_CREDENTIAL, Constants_1.Constants.IDENTITY_ASSERTION_CREDENTIAL],
    },
};
