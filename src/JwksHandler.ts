import { Logger } from "@aws-lambda-powertools/logger";
import { AppError } from "./utils/AppError";
import { HttpCodesEnum } from "./utils/HttpCodesEnum";
import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { Constants } from "./utils/Constants";
import { Jwk, JWKSBody, Algorithm } from "./utils/IVeriCredential";
import { DeleteObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import crypto from "crypto";
import * as AWS from "@aws-sdk/client-kms";
import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceFailedResponse, CloudFormationCustomResourceSuccessResponse, Context } from "aws-lambda";
import https from "https";
import url from "url";
import { IncomingMessage } from "http";

const POWERTOOLS_LOG_LEVEL = process.env.POWERTOOLS_LOG_LEVEL ? process.env.POWERTOOLS_LOG_LEVEL : "DEBUG";
const POWERTOOLS_SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ? process.env.POWERTOOLS_SERVICE_NAME : Constants.JWKS_LOGGER_SVC_NAME;
const logger = new Logger({
	logLevel: POWERTOOLS_LOG_LEVEL,
	serviceName: POWERTOOLS_SERVICE_NAME,
});

const SIGNING_KEY_IDS = process.env.SIGNING_KEY_IDS;
const ENCRYPTION_KEY_IDS = process.env.ENCRYPTION_KEY_IDS;
const JWKS_BUCKET_NAME = process.env.JWKS_BUCKET_NAME;

const s3Client = new S3Client({
	region: process.env.REGION,
	maxAttempts: 2,
	requestHandler: new NodeHttpHandler({
		connectionTimeout: 29000,
		socketTimeout: 29000,
	}),
});

const kmsClient = new AWS.KMS({
	region: process.env.REGION,
});

class JwksHandler implements LambdaInterface {

	async handler(event: CloudFormationCustomResourceEvent): Promise<CloudFormationCustomResourceFailedResponse | CloudFormationCustomResourceSuccessResponse> {
		try {
			if (event.RequestType === 'Delete') {
				const objects: ListObjectsV2CommandOutput = await s3Client.send(new ListObjectsV2Command({ Bucket: JWKS_BUCKET_NAME, MaxKeys: 256 }))
				objects.Contents?.forEach(async object => {
					await s3Client.send(new DeleteObjectCommand({
						Bucket: JWKS_BUCKET_NAME,
						Key: object.Key,
					}))
				});
			} else {
				if (!SIGNING_KEY_IDS || !ENCRYPTION_KEY_IDS || !JWKS_BUCKET_NAME) {
					logger.error({ message: "Environment variable SIGNING_KEY_IDS or ENCRYPTION_KEY_IDS or JWKS_BUCKET_NAME is not configured" });
					throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
				}
				const body: JWKSBody = { keys: [] };
				const kmsKeyIds = [
					...SIGNING_KEY_IDS.split(","),
					...ENCRYPTION_KEY_IDS.split(","),
				];
				logger.info({ message: "Building wellknown JWK endpoint with keys" + kmsKeyIds });

				const jwks = await Promise.all(
					kmsKeyIds.map(async id => getAsJwk(id)),
				);
				jwks.forEach(jwk => {
					if (jwk != null) {
						body.keys.push(jwk);
					} else logger.warn({ message: "Environment contains missing keys" });
				});

				const uploadParams = {
					Bucket: JWKS_BUCKET_NAME,
					Key: ".well-known/jwks.json",
					Body: JSON.stringify(body),
					ContentType: "application/json",
				};
				await s3Client.send(new PutObjectCommand(uploadParams));
			}
			const result: CloudFormationCustomResourceSuccessResponse = {
				PhysicalResourceId: `${JWKS_BUCKET_NAME}/.well-known/jwks.json`,
				StackId: event.StackId,
				RequestId: event.RequestId,
				LogicalResourceId: event.LogicalResourceId,
				Status: 'SUCCESS'
			}
			sendResponse(event.ResponseURL, result)
			return result
		} catch (err) {
			logger.error({ message: "Error writing keys to S3 bucket" + err });
			const result: CloudFormationCustomResourceFailedResponse = {
				PhysicalResourceId: `${JWKS_BUCKET_NAME}/.well-known/jwks.json`,
				StackId: event.StackId,
				RequestId: event.RequestId,
				LogicalResourceId: event.LogicalResourceId,
				Status: 'FAILED',
				Reason: 'Error creating jwks file. See logs for details.'
			}
			sendResponse(event.ResponseURL, result)
			return result
		}
	}
}
const getAsJwk = async (keyId: string): Promise<Jwk | null> => {
	let kmsKey;
	try {
		kmsKey = await kmsClient.getPublicKey({ KeyId: keyId });
	} catch (error) {
		logger.warn({ message: "Failed to fetch key from KMS" }, { error });
	}

	const map = getKeySpecMap(kmsKey?.KeySpec);
	if (
		kmsKey != null &&
		map != null &&
		kmsKey.KeyId != null &&
		kmsKey.PublicKey != null
	) {
		const use = kmsKey.KeyUsage === "ENCRYPT_DECRYPT" ? "enc" : "sig";
		const publicKey = crypto
			.createPublicKey({
				key: kmsKey.PublicKey as Buffer,
				type: "spki",
				format: "der",
			})
			.export({ format: "jwk" });
		return {
			...publicKey,
			use,
			kid: keyId.split("/").pop(),
			alg: map.algorithm,
		} as unknown as Jwk;
	}
	logger.error({ message: "Failed to build JWK from key" + keyId }, JSON.stringify(map));
	return null;
};

const getKeySpecMap = (
	spec?: string,
): { keySpec: string; algorithm: Algorithm } | undefined => {
	if (spec == null) return undefined;
	const conversions = [
		{
			keySpec: "ECC_NIST_P256",
			algorithm: "ES256" as Algorithm,
		},
		{
			keySpec: "RSA_2048",
			algorithm: "RS256" as Algorithm,
		},
	];
	return conversions.find(x => x.keySpec === spec);
};
const handlerClass = new JwksHandler();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);

const sendResponse = (uri: string, body: CloudFormationCustomResourceFailedResponse | CloudFormationCustomResourceSuccessResponse) => {
	const bodyString = JSON.stringify(body)
	const parsedUrl = url.parse(uri);
	const options = {
		hostname: parsedUrl.hostname,
		port: 443,
		path: parsedUrl.path,
		method: "PUT",
		headers: {
			"content-type": "application/json",
			"content-length": bodyString.length
		}
	};

	const request = https.request(options, (res) => {
		console.log('statusCode:', res.statusCode);
		console.log('headers:', res.headers);
		res.on('data', (d) => {
			console.log(d);
		});
		request.on("error", (e) => {
			console.log(e, 'sad times')
		});
	});
	request.write(bodyString);
	request.end();
}