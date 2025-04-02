 
import format from "ecdsa-sig-formatter";
import { KmsJwtAdapter } from "../../../utils/KmsJwtAdapter";
import { Constants } from "../../../utils/Constants";
import { absoluteTimeNow } from "../../../utils/DateTimeUtils";
import { jwtUtils } from "../../../utils/JwtUtils";
import { MessageType } from "@aws-sdk/client-kms";

import axios from "axios";

jest.mock('axios');

jest.mock("@aws-sdk/client-kms", () => ({
	MessageType: {
		DIGEST: "DIGEST",
		RAW: "RAW"
	},
	SigningAlgorithmSpec: {
		ECDSA_SHA_256: "ECDSA_SHA_256"
	},
	KMS: jest.fn().mockImplementation(() => ({
		sign: jest.fn().mockImplementation(() => ({
			Signature: "signature",
		})),
		verify: jest.fn().mockImplementation(() => ({
			SignatureValid: true,
		}))
	})),
}));

jest.mock("ecdsa-sig-formatter", () => ({
	derToJose: jest.fn().mockImplementation(() => "JOSE-formatted signature"),
	joseToDer: jest.fn().mockImplementation(() => "DER-formatted signature"),
}));

jest.mock("../../../utils/JwtUtils", () => ({
	jwtUtils: {
		base64Encode: jest.fn().mockImplementation((args) => JSON.parse(args)),
		base64DecodeToString: jest.fn().mockImplementation((args) => JSON.stringify(args)),
		getHashedKid: jest.fn().mockImplementation((args) => JSON.stringify(args)),
	},
}));

describe("KmsJwtAdapter utils", () => {
	let kmsJwtAdapter: KmsJwtAdapter;

	beforeEach(() => {
		kmsJwtAdapter = new KmsJwtAdapter(process.env.KMS_KEY_ARN!);
	});

	describe("#sign", () => {
		it("returns a signed access token", async () => {
			const jwtHeader = { alg: "ES256", typ: "JWT", kid: kmsJwtAdapter.kid };
			const kid = kmsJwtAdapter.kid.split("/").pop();
			const dnsSuffix = "test.gov.uk";
			if (kid != null) {
				jwtHeader.kid = (`did:web:${dnsSuffix}#${jwtUtils.getHashedKid(kid)}`);
			}
			const jwtPayload = {
				sub: "b0668808-67ce-8jc7-a2fc-132b81612111",
				aud: process.env.ISSUER,
				iss: process.env.ISSUER,
				exp: absoluteTimeNow() + Constants.TOKEN_EXPIRY_SECONDS,
			};

			const accessToken = await kmsJwtAdapter.sign(jwtPayload, dnsSuffix);
			expect(jwtUtils.base64Encode).toHaveBeenNthCalledWith(1, JSON.stringify(jwtHeader));
			expect(jwtUtils.base64Encode).toHaveBeenNthCalledWith(2, JSON.stringify(jwtPayload));
			expect(jwtUtils.getHashedKid).toHaveBeenNthCalledWith(2, kid);
			expect(format.derToJose).toHaveBeenCalledWith(Buffer.from("signature").toString("base64"), "ES256");
			expect(accessToken).toBe(`${jwtHeader}.${jwtPayload}.JOSE-formatted signature`);
		});

		it("error is thrown if jwt cannot be signed", async () => {
			const jwtPayload = {
				sub: "b0668808-67ce-8jc7-a2fc-132b81612111",
				aud: process.env.ISSUER,
				iss: process.env.ISSUER,
				exp: absoluteTimeNow() + Constants.TOKEN_EXPIRY_SECONDS,
			};

			jest.spyOn(kmsJwtAdapter.kms, "sign").mockImplementationOnce(() => ({ Signature: null }));

			await expect(kmsJwtAdapter.sign(jwtPayload, "test.gov.uk")).rejects.toThrow(expect.objectContaining({ message: "Failed to sign Jwt" }));
		});
	});

	describe("#verify", () => {
		it("returns true if jwt is valid", async () => {
			const isValid = await kmsJwtAdapter.verify("header.payload.signature");

			expect(kmsJwtAdapter.kms.verify).toHaveBeenCalledWith({
				KeyId: process.env.KMS_KEY_ARN,
				Message: Buffer.from("header.payload"),
				MessageType: MessageType.RAW,
				Signature: "DER-formatted signature",
				SigningAlgorithm: "ECDSA_SHA_256",
			});
			expect(isValid).toBe(true);
		});

		it("returns false if jwt is invalid", async () => {
			jest.spyOn(kmsJwtAdapter.kms, "verify").mockImplementationOnce(() => ({ SignatureValid: null }));

			const isValid = await kmsJwtAdapter.verify("header.payload.signature");

			expect(isValid).toBe(false);
		});

		it("error is thrown if jwt can't be verified", async () => {
			jest.spyOn(kmsJwtAdapter.kms, "verify").mockImplementationOnce(() => {
				throw new Error("cannot verify signature");
			});

			await expect(kmsJwtAdapter.verify("header.payload.signature")).rejects.toThrow(expect.objectContaining({ message: "Failed to verify signature: Error: cannot verify signature" }));
		});
	});

	describe("#decode", () => {
		it("returns correctly formatted result", () => {
			expect(kmsJwtAdapter.decode("header.payload.signature")).toEqual({
				header: "header",
				payload: "payload",
				signature: "signature",
			});
		});
	});

	describe("#decrypt", () => {
		it("throws error if the jwe doesn't contain the correct number of components", async () => {
			await expect(kmsJwtAdapter.decrypt("protectedHeader.encryptedKey.iv.ciphertext")).rejects.toThrow(expect.objectContaining({ message: "Error decrypting JWE: Missing component" }));
		});
	});

	describe("#verifyWithJwks", () => {
		const mockPublicKeyEndpoint = 'https://example.com/jwks';
		const mockTargetKid = '1234';
		// JWT has 'exp' value set to Friday, 9 March 2125 12:58:39 to ensure jose.jwtVerify() always passes
		const encodedJwt = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijg2NTRmYmMxLTExMjEtNGIzOC1iMDM2LTAxM2RmODRjYmNlYyJ9.eyJzdWIiOiIyOTk4NmRkNS0wMWVjLTQyMzYtYWMyMS01ODQ1ZmRhZmQ5YjUiLCJyZWRpcmVjdF91cmkiOiJodHRwczovL2lwdnN0dWIucmV2aWV3LWMuZGV2LmFjY291bnQuZ292LnVrL3JlZGlyZWN0IiwicmVzcG9uc2VfdHlwZSI6ImNvZGUiLCJnb3Z1a19zaWduaW5fam91cm5leV9pZCI6Ijg4Y2UxNmUxZTU5MTkxZjE0YzlkMzU3MDk4M2JiYTg3IiwiYXVkIjoiaHR0cHM6Ly9jaWMtY3JpLWZyb250LnJldmlldy1jLmRldi5hY2NvdW50Lmdvdi51ayIsImlzcyI6Imh0dHBzOi8vaXB2LmNvcmUuYWNjb3VudC5nb3YudWsiLCJjbGllbnRfaWQiOiI1QzU4NDU3MiIsInN0YXRlIjoiZGYyMjVjNzdlN2MzOWU4ODJjM2FhNzc0NjcyMGM0NjUiLCJpYXQiOjE3NDM1OTg3MTksIm5iZiI6MTc0MzU5ODcxOCwiZXhwIjo0ODk3MTk4NzE5LCJzaGFyZWRfY2xhaW1zIjp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidmFsdWUiOiJGcmVkZXJpY2siLCJ0eXBlIjoiR2l2ZW5OYW1lIn0seyJ2YWx1ZSI6Ikpvc2VwaCIsInR5cGUiOiJHaXZlbk5hbWUifSx7InZhbHVlIjoiRmxpbnRzdG9uZSIsInR5cGUiOiJGYW1pbHlOYW1lIn1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTYwLTAyLTAyIn1dLCJlbWFpbCI6ImV4YW1wbGVAdGVzdGVtYWlsLmNvbSJ9fQ.7M7WQqMK1cp8zin6Rb2ZBxmxvsjc3vWTjdHpKYJApvzdXo6S1lxRK52l-rJR3AeBW7QS-28j6PW4LhgkX6O1mA"
		const mockJwksResponse = {
			"keys": [
			  {
				kty: "EC",
				x: "5KIC1DrBMWrwOUMc-xEph9D_jfGeG9uOMJcuJ9g8Yic",
				y: "xMQcIwuJonk4nY9x7opfJ2bJPtFA2PECu1hXruK2osM",
				crv: "P-256",
				use: "sig",
				kid: "1234",
				alg: "ES256"
			  }
			]
		}

		// Jose validation is not mocked for this test
		it("should successfully verify a JWT", async () => {
			(axios.get as jest.Mock).mockResolvedValue({ data: mockJwksResponse });
			const result = await kmsJwtAdapter.verifyWithJwks(encodedJwt, mockPublicKeyEndpoint, mockTargetKid);
			expect(axios.get).toHaveBeenCalledWith(mockPublicKeyEndpoint);
    		expect(result?.sub).toEqual("29986dd5-01ec-4236-ac21-5845fdafd9b5");
		});

		it('should throw an error if no key is found with the specified kid', async () => {
			const invalidKid = 'INVALID_KID';
			await expect(kmsJwtAdapter.verifyWithJwks(encodedJwt, mockPublicKeyEndpoint, invalidKid)
			).rejects.toThrowError(`No key found with kid '${invalidKid}'`);
			});


	});
});
