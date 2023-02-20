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
exports.lambdaHandler = void 0;
const logger_1 = require("@aws-lambda-powertools/logger");
const AppError_1 = require("./utils/AppError");
const HttpCodesEnum_1 = require("./utils/HttpCodesEnum");
const Constants_1 = require("./utils/Constants");
const client_s3_1 = require("@aws-sdk/client-s3");
const node_http_handler_1 = require("@aws-sdk/node-http-handler");
const crypto_1 = __importDefault(require("crypto"));
const AWS = __importStar(require("@aws-sdk/client-kms"));
const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants_1.Constants.JWKS_LOGGER_SVC_NAME;
const logger = new logger_1.Logger({
    logLevel: POWERTOOLS_LOG_LEVEL,
    serviceName: POWERTOOLS_SERVICE_NAME,
});
const SIGNING_KEY_IDS = process.env.SIGNING_KEY_IDS;
const ENCRYPTION_KEY_IDS = process.env.ENCRYPTION_KEY_IDS;
const JWKS_BUCKET_NAME = process.env.JWKS_BUCKET_NAME;
const s3Client = new client_s3_1.S3Client({
    region: process.env.REGION,
    maxAttempts: 2,
    requestHandler: new node_http_handler_1.NodeHttpHandler({
        connectionTimeout: 29000,
        socketTimeout: 29000,
    }),
});
const kmsClient = new AWS.KMS({
    region: process.env.REGION,
});
class JwksHandler {
    async handler() {
        if (!SIGNING_KEY_IDS || !ENCRYPTION_KEY_IDS || !JWKS_BUCKET_NAME) {
            logger.error({ message: "Environment variable SIGNING_KEY_IDS or ENCRYPTION_KEY_IDS or JWKS_BUCKET_NAME is not configured" });
            throw new AppError_1.AppError("Service incorrectly configured", HttpCodesEnum_1.HttpCodesEnum.SERVER_ERROR);
        }
        const body = { keys: [] };
        const kmsKeyIds = [
            ...SIGNING_KEY_IDS.split(","),
            ...ENCRYPTION_KEY_IDS.split(","),
        ];
        logger.info({ message: "Building wellknown JWK endpoint with keys" + kmsKeyIds });
        const jwks = await Promise.all(kmsKeyIds.map(async (id) => getAsJwk(id)));
        jwks.forEach(jwk => {
            if (jwk != null) {
                body.keys.push(jwk);
            }
            else
                logger.warn({ message: "Environment contains missing keys" });
        });
        const uploadParams = {
            Bucket: JWKS_BUCKET_NAME,
            Key: ".well-known/jwks.json",
            Body: JSON.stringify(body),
            ContentType: "application/json",
        };
        try {
            await s3Client.send(new client_s3_1.PutObjectCommand(uploadParams));
        }
        catch (err) {
            logger.error({ message: "Error writing keys to S3 bucket" + err });
            throw new Error("Error writing keys to S3 bucket");
        }
        return JSON.stringify(body);
    }
}
const getAsJwk = async (keyId) => {
    let kmsKey;
    try {
        kmsKey = await kmsClient.getPublicKey({ KeyId: keyId });
    }
    catch (error) {
        logger.warn({ message: "Failed to fetch key from KMS" }, { error });
    }
    const map = getKeySpecMap(kmsKey?.KeySpec);
    if (kmsKey != null &&
        map != null &&
        kmsKey.KeyId != null &&
        kmsKey.PublicKey != null) {
        const use = kmsKey.KeyUsage === "ENCRYPT_DECRYPT" ? "enc" : "sig";
        const publicKey = crypto_1.default
            .createPublicKey({
            key: kmsKey.PublicKey,
            type: "spki",
            format: "der",
        })
            .export({ format: "jwk" });
        return {
            ...publicKey,
            use,
            kid: keyId.split("/").pop(),
            alg: map.algorithm,
        };
    }
    logger.error({ message: "Failed to build JWK from key" + keyId }, JSON.stringify(map));
    return null;
};
const getKeySpecMap = (spec) => {
    if (spec == null)
        return undefined;
    const conversions = [
        {
            keySpec: "ECC_NIST_P256",
            algorithm: "ES256",
        },
        {
            keySpec: "RSA_2048",
            algorithm: "RS256",
        },
    ];
    return conversions.find(x => x.keySpec === spec);
};
const handlerClass = new JwksHandler();
exports.lambdaHandler = handlerClass.handler.bind(handlerClass);
