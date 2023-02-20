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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KmsJwtAdapter = void 0;
const ecdsa_sig_formatter_1 = __importDefault(require("ecdsa-sig-formatter"));
const buffer_1 = require("buffer");
const IVeriCredential_1 = require("./IVeriCredential");
const AWS = __importStar(require("@aws-sdk/client-kms"));
const JwtUtils_1 = require("./JwtUtils");
const client_kms_1 = require("@aws-sdk/client-kms");
const crypto_1 = __importDefault(require("crypto"));
const jose_1 = require("jose");
const axios_1 = __importDefault(require("axios"));
class KmsJwtAdapter {
    constructor(kid) {
        this.kms = new AWS.KMS({
            region: process.env.REGION,
        });
        /**
         * An implemention the JWS standard using KMS to sign Jwts
         *
         * kid: The key Id of the KMS key
         */
        this.ALG = "ECDSA_SHA_256";
        this.kid = kid;
    }
    async sign(jwtPayload) {
        const jwtHeader = { alg: "ES256", typ: "JWT" };
        const kid = this.kid.split("/").pop();
        if (kid != null) {
            jwtHeader.kid = kid;
        }
        const tokenComponents = {
            header: JwtUtils_1.jwtUtils.base64Encode(JSON.stringify(jwtHeader)),
            payload: JwtUtils_1.jwtUtils.base64Encode(JSON.stringify(jwtPayload)),
            signature: "",
        };
        const params = {
            Message: buffer_1.Buffer.from(`${tokenComponents.header}.${tokenComponents.payload}`),
            KeyId: this.kid,
            SigningAlgorithm: this.ALG,
            MessageType: "RAW",
        };
        const res = await this.kms.sign(params);
        if (res.Signature == null) {
            throw new Error("Failed to sign Jwt");
        }
        tokenComponents.signature = ecdsa_sig_formatter_1.default.derToJose(buffer_1.Buffer.from(res.Signature).toString("base64"), "ES256");
        return `${tokenComponents.header}.${tokenComponents.payload}.${tokenComponents.signature}`;
    }
    async verify(urlEncodedJwt) {
        const [header, payload, signature] = urlEncodedJwt.split(".");
        const message = buffer_1.Buffer.from(`${header}.${payload}`);
        try {
            const derSignature = ecdsa_sig_formatter_1.default.joseToDer(signature, "ES256");
            const result = await this.kms.verify({
                KeyId: this.kid,
                Message: message,
                MessageType: "RAW",
                Signature: derSignature,
                SigningAlgorithm: this.ALG,
            });
            return result.SignatureValid ?? false;
        }
        catch (error) {
            throw new Error("Failed to verify signature: " + error);
        }
    }
    async verifyWithJwks(urlEncodedJwt, publicKeyEndpoint) {
        const oidcProviderJwks = (await axios_1.default.get(publicKeyEndpoint)).data;
        const signingKey = oidcProviderJwks.keys.find((key) => key.use === "sig");
        const publicKey = await (0, jose_1.importJWK)(signingKey, signingKey.alg);
        try {
            const { payload } = await (0, jose_1.jwtVerify)(urlEncodedJwt, publicKey);
            return payload;
        }
        catch (error) {
            throw new Error("Failed to verify signature: " + error);
        }
    }
    decode(urlEncodedJwt) {
        const [header, payload, signature] = urlEncodedJwt.split(".");
        const result = {
            header: JSON.parse(JwtUtils_1.jwtUtils.base64DecodeToString(header)),
            payload: JSON.parse(JwtUtils_1.jwtUtils.base64DecodeToString(payload)),
            signature,
        };
        return result;
    }
    async decrypt(serializedJwe) {
        const jweComponents = serializedJwe.split(".");
        if (jweComponents.length !== 5) {
            throw new IVeriCredential_1.JsonWebTokenError("Error decrypting JWE: Missing component");
        }
        const [protectedHeader, encryptedKey, iv, ciphertext, tag,] = jweComponents;
        let cek;
        try {
            const inputs = {
                CiphertextBlob: JwtUtils_1.jwtUtils.base64DecodeToUint8Array(encryptedKey),
                EncryptionAlgorithm: "RSAES_OAEP_SHA_256",
                KeyId: process.env.ENCRYPTION_KEY_IDS,
            };
            const output = await this.kms.send(new client_kms_1.DecryptCommand(inputs));
            const plaintext = output.Plaintext ?? null;
            if (plaintext === null) {
                throw new Error("No Plaintext received when calling KMS to decrypt the Encryption Key");
            }
            cek = plaintext;
        }
        catch (err) {
            throw new IVeriCredential_1.JsonWebTokenError("Error decrypting JWE: Unable to decrypt encryption key via KMS", err);
        }
        let payload;
        try {
            const webcrypto = crypto_1.default.webcrypto;
            const cek1 = await webcrypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
            const decryptedBuffer = await webcrypto.subtle.decrypt({
                name: "AES-GCM",
                iv: JwtUtils_1.jwtUtils.base64DecodeToUint8Array(iv),
                additionalData: new Uint8Array(buffer_1.Buffer.from(protectedHeader)),
                tagLength: 128,
            }, cek1, buffer_1.Buffer.concat([new Uint8Array(JwtUtils_1.jwtUtils.base64DecodeToUint8Array(ciphertext)), new Uint8Array(JwtUtils_1.jwtUtils.base64DecodeToUint8Array(tag))]));
            payload = new Uint8Array(decryptedBuffer);
        }
        catch (err) {
            throw new IVeriCredential_1.JsonWebTokenError("Error decrypting JWE: Unable to decrypt payload via Crypto", err);
        }
        try {
            return JwtUtils_1.jwtUtils.decode(payload);
        }
        catch (err) {
            throw new IVeriCredential_1.JsonWebTokenError("Error decrypting JWE: Unable to decode the decrypted payload", err);
        }
    }
}
exports.KmsJwtAdapter = KmsJwtAdapter;
