/* eslint-disable @typescript-eslint/unbound-method */
import { lambdaHandler, logger, kmsClient, s3Client, getAsJwk, getKeySpecMap } from "../../JwksHandler";
import { HttpCodesEnum } from "../../utils/HttpCodesEnum";
import { Jwk, Algorithm } from "../../utils/IVeriCredential";
import crypto from "crypto";

jest.mock("@aws-lambda-powertools/logger", () => ({
	Logger: jest.fn().mockImplementation(() => ({
		info: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
	})),
}));

jest.mock("@aws-sdk/client-kms", () => ({
	KMS: jest.fn().mockImplementation(() => ({
		getPublicKey: jest.fn(),
	})),
}));

jest.mock("crypto", () => ({
	createPublicKey: jest.fn().mockImplementation(() => ({
		export: jest.fn().mockImplementation(() => ({
			key: "123456789",
		})),
	})),
}));

jest.mock("@aws-sdk/client-s3", () => ({
	S3Client: jest.fn().mockImplementation(() => ({
		send: jest.fn(),
	})),
	PutObjectCommand: jest.fn().mockImplementation((args) => args),
}));

describe("JwksHandler", () => {
	describe("#handler", () => {
		beforeEach(() => {
			process.env.SIGNING_KEY_IDS = "cic-cri-api-vc-signing-key";
			process.env.ENCRYPTION_KEY_IDS = "cic-cri-api-encryption-key";
			process.env.JWKS_BUCKET_NAME = "cic-cri-api-jwks-dev";
		});

		it("throws error if environment variables are missing", async () => {
			process.env.SIGNING_KEY_IDS = "";
			process.env.ENCRYPTION_KEY_IDS = "";
			process.env.JWKS_BUCKET_NAME = "";

			await expect(lambdaHandler()).rejects.toThrow(expect.objectContaining({
				message: "Service incorrectly configured",
				statusCode: HttpCodesEnum.SERVER_ERROR,
			}));
			expect(logger.error).toHaveBeenCalledWith({ message: "Environment variable SIGNING_KEY_IDS or ENCRYPTION_KEY_IDS or JWKS_BUCKET_NAME is not configured" });
		});

		it("uploads keys to s3", async () => {
			const body = {
				keys: [],
			};
    
			await lambdaHandler();

			expect(logger.info).toHaveBeenCalledWith({ message:"Building wellknown JWK endpoint with keys" + ["cic-cri-api-vc-signing-key", "cic-cri-api-encryption-key"] });
			expect(s3Client.send).toHaveBeenCalledWith({
				Bucket: "cic-cri-api-jwks-dev",
				Key: ".well-known/jwks.json",
				Body: JSON.stringify(body),
				ContentType: "application/json",
			});
		});
	});

	describe("#getAsJwk", () => {
		it("gets the kms key with the given KeyId and returns jwk with public key", async () => {
			const keyId = "cic-cri-api-vc-signing-key";
			const publicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAES4sDJifz8h3GDznZZ6NC3QN5qlQn8Zf2mck4yBmlwqvXzZu7Wkwc4QuOxXhGHXamfkoG5d0UJVXJwwvFxiSzRQ==";
			jest.spyOn(kmsClient, "getPublicKey").mockImplementationOnce(() => ({
				KeySpec: "ECC_NIST_P256",
				KeyId: keyId,
				KeyUsage: "ENCRYPT_DECRYPT",
				PublicKey: publicKey,
			}));

			const result = await getAsJwk(keyId);

			expect(kmsClient.getPublicKey).toHaveBeenCalledWith({ KeyId: keyId });
			expect(crypto.createPublicKey).toHaveBeenCalledWith({
				key: publicKey as unknown as Buffer,
				type: "spki",
				format: "der",
			});
			expect(result).toEqual({
				key: "123456789",
				use: "enc",
				kid: keyId.split("/").pop(),
				alg: "ES256" as Algorithm,
			} as unknown as Jwk);
		});

		it("logs error if no key is fetched", async () => {
			const keyId = "cic-cri-api-vc-signing-key";
			jest.spyOn(kmsClient, "getPublicKey").mockImplementationOnce(() => null);

			const result = await getAsJwk(keyId);

			expect(logger.error).toHaveBeenCalledWith({ message: "Failed to build JWK from key" + keyId }, undefined);
			expect(result).toBeNull();
		});

		it("logs error if fetched key does not contain KeySpec", async () => {
			const keyId = "cic-cri-api-vc-signing-key";
			const publicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAES4sDJifz8h3GDznZZ6NC3QN5qlQn8Zf2mck4yBmlwqvXzZu7Wkwc4QuOxXhGHXamfkoG5d0UJVXJwwvFxiSzRQ==";
			jest.spyOn(kmsClient, "getPublicKey").mockImplementationOnce(() => ({
				KeyId: keyId,
				KeyUsage: "ENCRYPT_DECRYPT",
				PublicKey: publicKey,
			}));

			const result = await getAsJwk(keyId);

			expect(logger.error).toHaveBeenCalledWith({ message: "Failed to build JWK from key" + keyId }, undefined);
			expect(result).toBeNull();
		});

		it("logs error if fetched key does not contain KeyId", async () => {
			const keyId = "cic-cri-api-vc-signing-key";
			const publicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAES4sDJifz8h3GDznZZ6NC3QN5qlQn8Zf2mck4yBmlwqvXzZu7Wkwc4QuOxXhGHXamfkoG5d0UJVXJwwvFxiSzRQ==";
			jest.spyOn(kmsClient, "getPublicKey").mockImplementationOnce(() => ({
				KeySpec: "ECC_NIST_P256",
				KeyUsage: "ENCRYPT_DECRYPT",
				PublicKey: publicKey,
			}));

			const result = await getAsJwk(keyId);

			expect(logger.error).toHaveBeenCalledWith({ message: "Failed to build JWK from key" + keyId }, JSON.stringify({
				keySpec: "ECC_NIST_P256",
				algorithm: "ES256" as Algorithm,
			}));
			expect(result).toBeNull();
		});

		it("logs error if fetched key does not contain PublicKey", async () => {
			const keyId = "cic-cri-api-vc-signing-key";
			const publicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAES4sDJifz8h3GDznZZ6NC3QN5qlQn8Zf2mck4yBmlwqvXzZu7Wkwc4QuOxXhGHXamfkoG5d0UJVXJwwvFxiSzRQ==";
			jest.spyOn(kmsClient, "getPublicKey").mockImplementationOnce(() => ({
				KeySpec: "ECC_NIST_P256",
				KeyUsage: "ENCRYPT_DECRYPT",
				KeyId: keyId,
			}));

			const result = await getAsJwk(keyId);

			expect(logger.error).toHaveBeenCalledWith({ message: "Failed to build JWK from key" + keyId }, JSON.stringify({
				keySpec: "ECC_NIST_P256",
				algorithm: "ES256" as Algorithm,
			}));
			expect(result).toBeNull();
		});
	});

	describe("#getKeySpecMap", () => {
		it("returns undefined if spec is not given", () => {
			expect(getKeySpecMap()).toBeUndefined();
		});

		it("returns the correct key spec map for ECC_NIST_P256 spec", () => {
			expect(getKeySpecMap("ECC_NIST_P256")).toEqual({
				keySpec: "ECC_NIST_P256",
				algorithm: "ES256" as Algorithm,
			});
		});

		it("returns the correct key spec map for RSA_2048 spec", () => {
			expect(getKeySpecMap("RSA_2048")).toEqual({
				keySpec: "RSA_2048",
				algorithm: "RS256" as Algorithm,
			});
		});
	});
});
