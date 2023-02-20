"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonWebTokenError = exports.JarPayload = void 0;
class JarPayload {
}
exports.JarPayload = JarPayload;
class JsonWebTokenError extends Error {
    constructor(message, error) {
        super(message);
        this.inner = error;
    }
}
exports.JsonWebTokenError = JsonWebTokenError;
