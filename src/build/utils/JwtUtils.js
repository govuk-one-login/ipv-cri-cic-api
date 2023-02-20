"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtUtils = void 0;
const jose = __importStar(require("node-jose"));
exports.jwtUtils = {
    // convert non-base64 string or uint8array into base64 encoded string
    base64Encode(value) {
        return jose.util.base64url.encode(Buffer.from(value), "utf8");
    },
    // convert base64 into uint8array
    base64DecodeToUint8Array(value) {
        return new Uint8Array(jose.util.base64url.decode(value));
    },
    // convert base64 encoded string into non-base64 string
    base64DecodeToString(value) {
        return Buffer.from(value, "base64url").toString();
    },
    // convert uint8array into string
    decode(value) {
        const decoder = new TextDecoder();
        return decoder.decode(value);
    },
    // convert string into uint8array
    encode(value) {
        const encoder = new TextEncoder();
        return encoder.encode(value);
    },
};
