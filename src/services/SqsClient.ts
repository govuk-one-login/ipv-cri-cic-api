import { SQSClient } from "@aws-sdk/client-sqs";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";

const SqsClient = new SQSClient({
	region: process.env.REGION,
	maxAttempts: 2,
	requestHandler: new NodeHttpHandler({
		connectionTimeout: 29000,
		socketTimeout: 29000,
	}),
});

export { SqsClient };
