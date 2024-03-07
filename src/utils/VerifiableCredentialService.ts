/* eslint-disable max-lines-per-function */
import { Logger } from "@aws-lambda-powertools/logger";
import { VerifiedCredential } from "./IVeriCredential";
import { KmsJwtAdapter } from "./KmsJwtAdapter";
import { ISessionItem } from "../models/ISessionItem";
import { PersonIdentityNamePart } from "../models/PersonIdentityItem";
import { AppError } from "./AppError";
import { HttpCodesEnum } from "./HttpCodesEnum";
import { Constants } from "./Constants";
import { randomUUID } from "crypto";
import { mockVcClaims } from "../tests/contract/mocks/VerifiableCredential";

export class VerifiableCredentialService {
	readonly tableName: string;

	readonly logger: Logger;

	readonly issuer: string;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	private static instance: VerifiableCredentialService;

	constructor(tableName: any, kmsJwtAdapter: KmsJwtAdapter, issuer: any, logger: Logger) {
		this.issuer = issuer;
		this.tableName = tableName;
		this.logger = logger;
		this.kmsJwtAdapter = kmsJwtAdapter;
	}

	static getInstance(tableName: string, kmsJwtAdapter: KmsJwtAdapter, issuer: string, logger: Logger): VerifiableCredentialService {
		if (!VerifiableCredentialService.instance) {
			VerifiableCredentialService.instance = new VerifiableCredentialService(tableName, kmsJwtAdapter, issuer, logger);
		}
		return VerifiableCredentialService.instance;
	}

	async generateSignedVerifiableCredentialJwt(
		sessionItem: ISessionItem,
		nameParts: PersonIdentityNamePart[],
		birthDay: string,
		getNow: () => number,
	): Promise<string> {
		const now = getNow();
		const subject = sessionItem.subject;
		const verifiedCredential: VerifiedCredential = new VerifiableCredentialBuilder(nameParts, birthDay)
			.build();
		let result;
		if (process.env.USE_MOCKED) {
			this.logger.info("VcService: USING MOCKED");
			result = {
				...mockVcClaims,
				iss: this.issuer,
				sub: subject,
				vc: verifiedCredential,
			};
		} else {
			 result = {
				sub: subject,
				nbf: now,
				iss: this.issuer,
				iat: now,
				jti: randomUUID(),
				vc: verifiedCredential,
			};
		}

		this.logger.info("Generated VerifiableCredential jwt", {
    		jti: result.jti,
    	});
		try {
			// Sign the VC
			return await this.kmsJwtAdapter.sign(result);
		} catch (error) {
			this.logger.error("Failed to sign Jwt", {
    			error,
    		});
    		throw new AppError( "Server Error", HttpCodesEnum.SERVER_ERROR);
		}
	}
}

class VerifiableCredentialBuilder {
	private readonly credential: VerifiedCredential;

	constructor(nameParts: PersonIdentityNamePart[], date_of_birth: string) {
		this.credential = {
			"@context": [
				Constants.W3_BASE_CONTEXT,
				Constants.DI_CONTEXT,
			],
			type: [
				Constants.VERIFIABLE_CREDENTIAL,
				Constants.IDENTITY_ASSERTION_CREDENTIAL,
			],
			credentialSubject: {
				name: [
					{
						nameParts,
					}],
				birthDate: [{ value: date_of_birth }],
			},
		};
	}

	build(): VerifiedCredential {
		return this.credential;
	}
}
