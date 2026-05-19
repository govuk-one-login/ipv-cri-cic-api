import { vi } from "vitest";
import { logger } from "@govuk-one-login/cri-logger";
import { SQSEvent } from "aws-lambda";
import { lambdaHandler } from "../../DequeueHandler";
import { BatchItemFailure } from "../../utils/BatchItemFailure";
import { mockClient } from "aws-sdk-client-mock";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

vi.mock("@govuk-one-login/cri-logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  },
}));

vi.useFakeTimers().setSystemTime(new Date("2020-01-01"));

const s3Mock = mockClient(S3Client);

describe("DequeueHandler", () => {
  const body1 = JSON.stringify({
    event_name: "TEST_EVENT",
    sub: "test_SUB_1",
  });
  const body2 = JSON.stringify({
    event_name: "TEST_EVENT",
    sub: "test_SUB_2",
  });
  const event = {
    Records: [
      { messageId: "11111", body: body1 },
      { messageId: "22222", body: body2 },
    ],
  };

  beforeEach(() => {
    process.env.BUCKET_FOLDER_PREFIX = "txma/";
    process.env.EVENT_TEST_BUCKET_NAME = "test-bucket";
    process.env.PROPERTY_NAME = "sub";
    s3Mock.reset();
  });

  it("Returns no batchItemFailures if all events were successfully sent to S3 where property name is sub", async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const result = await lambdaHandler(event as SQSEvent);
    expect(logger.info).toHaveBeenCalledWith("Starting to process records");
    expect(logger.info).toHaveBeenCalledWith(
			`Uploading object with key txma/test_SUB_1-2020-01-01T00:00:00.000Z-11111 to bucket test-bucket`,
		);
    expect(logger.info).toHaveBeenCalledWith(
			`Uploading object with key txma/test_SUB_2-2020-01-01T00:00:00.000Z-22222 to bucket test-bucket`,
		);
    expect(logger.info).toHaveBeenCalledWith("Finished processing records");
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it("Returns no batchItemFailures if all events were successfully sent to S3 where property name is user.session_id", async () => {
    process.env.PROPERTY_NAME = "user.session_id";
    const body1 = JSON.stringify({
      event_name: "CIC_CRI_START",
      user: {
        session_id: "test_user_id_1",
			},
    });
    const body2 = JSON.stringify({
      event_name: "CIC_CRI_START",
      user: {
        session_id: "test_user_id_2",
			},
    });
    const txmaEvent = {
      Records: [
        { messageId: "11111", body: body1 },
        { messageId: "22222", body: body2 },
      ],
    };

    s3Mock.on(PutObjectCommand).resolves({});

    const result = await lambdaHandler(txmaEvent as SQSEvent);
    expect(logger.info).toHaveBeenCalledWith("Starting to process records");
    expect(logger.info).toHaveBeenCalledWith(
			`Uploading object with key txma/test_user_id_1-2020-01-01T00:00:00.000Z-11111 to bucket test-bucket`,
		);
    expect(logger.info).toHaveBeenCalledWith(
			`Uploading object with key txma/test_user_id_2-2020-01-01T00:00:00.000Z-22222 to bucket test-bucket`,
		);
    expect(logger.info).toHaveBeenCalledWith("Finished processing records");
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it("Returns batchItemFailures if events failed to send to S3", async () => {
    const error = new Error("Failed to send to S3");
    s3Mock.on(PutObjectCommand).rejectsOnce(error).resolves({});

    const result = await lambdaHandler(event as SQSEvent);
    expect(logger.error).toHaveBeenCalledWith({
			message: "Error writing keys to S3 bucket",
			error,
		});
    expect(logger.info).toHaveBeenCalledWith("Finished processing records");
    expect(result).toEqual({
			batchItemFailures: [new BatchItemFailure("11111")],
		});
  });
});
