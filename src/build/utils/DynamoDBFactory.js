"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDynamoDbClient = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const credential_providers_1 = require("@aws-sdk/credential-providers");
const aws_xray_sdk_core_1 = __importDefault(require("aws-xray-sdk-core"));
aws_xray_sdk_core_1.default.setContextMissingStrategy("LOG_ERROR");
const awsRegion = process.env.AWS_REGION;
const createDynamoDbClient = () => {
    const marshallOptions = {
        // Whether to automatically convert empty strings, blobs, and sets to `null`.
        convertEmptyValues: false,
        // Whether to remove undefined values while marshalling.
        removeUndefinedValues: true,
        // Whether to convert typeof object to map attribute.
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    const dbClient = new client_dynamodb_1.DynamoDBClient({ region: awsRegion, credentials: (0, credential_providers_1.fromEnv)() });
    const dbClientRaw = lib_dynamodb_1.DynamoDBDocument.from(dbClient, translateConfig);
    return process.env.XRAY_ENABLED === "true" ? aws_xray_sdk_core_1.default.captureAWSv3Client(dbClientRaw) : dbClientRaw;
};
exports.createDynamoDbClient = createDynamoDbClient;
