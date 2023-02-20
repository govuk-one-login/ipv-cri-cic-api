"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendMessageCommand = exports.sqsClient = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
Object.defineProperty(exports, "SendMessageCommand", { enumerable: true, get: function () { return client_sqs_1.SendMessageCommand; } });
const node_http_handler_1 = require("@aws-sdk/node-http-handler");
const aws_xray_sdk_core_1 = __importDefault(require("aws-xray-sdk-core"));
aws_xray_sdk_core_1.default.setContextMissingStrategy("LOG_ERROR");
const sqsClientRaw = new client_sqs_1.SQSClient({
    region: process.env.REGION,
    maxAttempts: 2,
    requestHandler: new node_http_handler_1.NodeHttpHandler({
        connectionTimeout: 29000,
        socketTimeout: 29000,
    }),
});
const sqsClient = process.env.XRAY_ENABLED === "true" ? aws_xray_sdk_core_1.default.captureAWSv3Client(sqsClientRaw) : sqsClientRaw;
exports.sqsClient = sqsClient;
