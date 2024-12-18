import { CloudFormationCustomResourceEvent, Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPublicKey, JsonWebKey, createHash } from "node:crypto";
import { GetPublicKeyCommand, GetPublicKeyCommandOutput, KMSClient } from "@aws-sdk/client-kms";
type JWKS = { keys: Array<JsonWebKey> }
const logger = new Logger();

const kmsClient = new KMSClient({
  region: "eu-west-2",
  maxAttempts: 2,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5000,
    requestTimeout: 5000,
  }),
});

const s3Client = new S3Client([
  {
    region: "eu-west-2",
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5000,
      requestTimeout: 5000,
    }),
  },
])

class JWKBuilder {
  private jwk: JsonWebKey
  constructor() {
    this.jwk = {}
  }

  addPublicKeyData(kmsPublicKey) {
    this.jwk = {
      ...createPublicKey({
        key: Buffer.from(kmsPublicKey),
        type: "spki",
        format: "der",
      }).export({ format: "jwk" }),
    };
    return this;
  }

  addMetadata(kmsOutput: GetPublicKeyCommandOutput) {
    if (kmsOutput.KeyId != null && kmsOutput.KeyUsage != null && kmsOutput.KeySpec != null && kmsOutput.PublicKey != null) {
      this.jwk.kid = createHash('sha256').update(kmsOutput.KeyId).digest('hex');
      this.jwk.alg = kmsOutput.KeySpec === "RSA_2048" ? 'RS256' : "ES256";
      this.jwk.use = kmsOutput.KeyUsage === "ENCRYPT_DECRYPT" ? 'enc' : "sig"
    }
    return this;
  }

  build() {
    return this.jwk
  }
}

export const lambdaHandler = async (event: CloudFormationCustomResourceEvent, context: Context) => {
  logger.addContext(context);
  const config = { ...process.env };
  const resultSender = new CustomResourceEventSender(event, context);

  if (config.KEY_IDS == null || config.BUCKET_NAME == null) {
    await resultSender.sendEvent("FAILED");
    return;
  }

  if (event.RequestType === "Delete") {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: config.BUCKET_NAME,
      Key: '/.well-known/jwks.json',
    }));
    await resultSender.sendEvent("SUCCESS");
    return;
  }
  if (["Create", "Update"].includes(event.RequestType)) {
    try {
      const jwks: JWKS = {
        keys: [],
      };
      for (const keyId of config.KEY_IDS?.split(',') ?? []) {
        try {
          const command = new GetPublicKeyCommand({ KeyId: keyId });
          const publicKeyOutput: GetPublicKeyCommandOutput = await kmsClient.send(command);

          if (
            !publicKeyOutput.KeySpec || ["RSA_2048", "ECC_NIST_P256"].includes(publicKeyOutput.KeySpec) ||
            !publicKeyOutput.KeyUsage || ["SIGN_VERIFY", "ENCRYPT_DECRYPT"].includes(publicKeyOutput.KeyUsage) ||
            !publicKeyOutput.PublicKey
          ) throw new Error("KMS response is missing required fields, or has provisioned keys with unsupported config");

          const jwk: JsonWebKey = new JWKBuilder()
            .addPublicKeyData(publicKeyOutput.PublicKey)
            .addMetadata(publicKeyOutput)
            .build();
          jwks.keys.push(jwk);
        }
        catch (err) {
          console.log('alarm here');
        }
      }
      if (jwks.keys.length == 0) {
        await resultSender.sendEvent("FAILED");
        return;
      }

      await s3Client.send(new PutObjectCommand({
        Body: JSON.stringify(jwks),
        Bucket: config.BUCKET_NAME,
        Key: '/.well-known/jwks.json',
        ContentType: "application.json",
      }));

      await resultSender.sendEvent("SUCCESS");
    } catch (err) {
      logger.error('Things went super wrong somewhere');
      await resultSender.sendEvent("FAILED");
      return;
    }
  }
  logger.info("COMPLETED");
  return;
}

export class CustomResourceEventSender {
  private readonly event: CloudFormationCustomResourceEvent;
  private readonly context: Context;

  constructor(event: CloudFormationCustomResourceEvent, context: Context) {
    this.event = event;
    this.context = context;
  }

  async sendEvent(status: "SUCCESS" | "FAILED"): Promise<void> {
    const customResourceResponseBody = {
      Status: status,
      Reason:
        "See the details in CloudWatch Log Stream: " +
        this.context.logStreamName,
      PhysicalResourceId: this.context.logStreamName,
      StackId: this.event.StackId,
      RequestId: this.event.RequestId,
      LogicalResourceId: this.event.LogicalResourceId,
      NoEcho: false,
    };

    const requestInit: RequestInit = {
      method: "PUT",
      body: JSON.stringify(customResourceResponseBody),
    };

    try {
      const response = await fetch(this.event.ResponseURL, requestInit);
      if (!response.ok) {
        throw new Error("Error sending Custom Resource event");
      } else {
        return;
      }
    } catch {
      throw new Error("Unexpected network error sending Custom Resource event");
    }
  }
}
