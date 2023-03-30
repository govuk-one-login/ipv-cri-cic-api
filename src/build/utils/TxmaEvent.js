"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCoreEventFields = void 0;
const DateTimeUtils_1 = require("./DateTimeUtils");
const buildCoreEventFields = (session, issuer, sourceIp, getNow = DateTimeUtils_1.absoluteTimeNow) => {
    return {
        user: {
            user_id: session.clientId,
            persistent_session_id: session.persistentSessionId,
            transaction_id: "",
            session_id: session.sessionId,
            govuk_signin_journey_id: session.clientSessionId,
            ip_address: sourceIp,
        },
        client_id: session.clientId,
        timestamp: getNow(),
        component_id: issuer,
    };
};
exports.buildCoreEventFields = buildCoreEventFields;
