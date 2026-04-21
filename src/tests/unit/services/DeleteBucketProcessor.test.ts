import { DeleteBucketProcessor } from "../../../services/DeleteBucketProcessor";
import { VALID_DELETE_REQUEST, VALID_CREATE_REQUEST, VALID_UPDATE_REQUEST } from "../data/delete-bucket-events";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";
import { S3Client, ListObjectVersionsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";

const s3Mock = mockClient(S3Client);
let deleteBucketProcessor: DeleteBucketProcessor;

describe("DeleteBucketProcessor", () => {
    beforeEach(() => {
      deleteBucketProcessor = new DeleteBucketProcessor();
      s3Mock.reset();
    });

    it("successfully empties buckets", async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          { Key: "remaining1.txt" },
          { Key: "remaining2.txt" },
        ],
      });

      global.fetch = vi.fn().mockResolvedValue({ status: 200 });
      const response = await deleteBucketProcessor.processRequest(VALID_DELETE_REQUEST)
      expect(response).toEqual({ statusCode: HttpCodesEnum.OK, body: "Bucket deleted" })
    });
    
    it("successfully empties bucket versions", async () => {
      s3Mock.on(ListObjectVersionsCommand).resolves({
        Versions: [
          { Key: "file1.txt", VersionId: "1" },
          { Key: "file2.txt", VersionId: "2" },
        ],
        DeleteMarkers: [
          { Key: "file3.txt", VersionId: "3" },
        ],
      });

      global.fetch = vi.fn().mockResolvedValue({ status: 200 });
      const response = await deleteBucketProcessor.processRequest(VALID_DELETE_REQUEST)
      expect(response).toEqual({ statusCode: HttpCodesEnum.OK, body: "Bucket deleted" })
    });

    it("throws error when sendResponse fetch request fails", async () => {
      global.fetch = vi.fn().mockRejectedValue({});
      await expect(deleteBucketProcessor.processRequest(VALID_DELETE_REQUEST)).rejects.toThrow();
    });

    it("returns SUCCESS when Create RequestType received", async () => {
      global.fetch = vi.fn().mockResolvedValue({ status: 200 });
      const response = await deleteBucketProcessor.processRequest(VALID_CREATE_REQUEST)
      expect(response).toEqual({ statusCode: HttpCodesEnum.OK, body: "Create success" })
    })

    it("returns SUCCESS when Update RequestType received", async () => {
      global.fetch = vi.fn().mockResolvedValue({ status: 200 });
      const response = await deleteBucketProcessor.processRequest(VALID_UPDATE_REQUEST)
      expect(response).toEqual({ statusCode: HttpCodesEnum.OK, body: "Update success" })
    })
});