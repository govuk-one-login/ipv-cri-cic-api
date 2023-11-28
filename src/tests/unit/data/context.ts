import { Context } from "aws-lambda";

export const CONTEXT: Context = {
	awsRequestId: "",
	callbackWaitsForEmptyEventLoop: false,
	functionName: "CIC",
	functionVersion: "",
	invokedFunctionArn: "",
	logGroupName: "",
	logStreamName: "",
	memoryLimitInMB: "",
	done(): void {},
	fail(): void {},
	getRemainingTimeInMillis(): number {
		return 0;
	},
	succeed(): void {},
};
