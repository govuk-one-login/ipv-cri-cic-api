import { SQSClient } from "@aws-sdk/client-sqs";
import { fromEnv } from "@aws-sdk/credential-providers";


const awsRegion = process.env.AWS_REGION;
export const createSQSClient = () => {
	return new SQSClient({ region: awsRegion, credentials: fromEnv() });
};
