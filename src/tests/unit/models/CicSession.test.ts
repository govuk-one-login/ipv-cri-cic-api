import { ValidationHelper } from "../../../utils/ValidationHelper";
import { CicSession } from "../../../models/CicSession";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({
	logLevel: "ERROR",
	serviceName: "CIC",
});

describe("CicSession", () => {
	it("should validate CicSession model", async () => {
		const cicSession = new CicSession(
			"Frederick Joseph",
			"Flintstone",
			"1970-01-01",
		);

		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should throw error if given_names is empty in CicSession model", async () => {
		const cicSession = new CicSession(
			"",
			"Flintstone",
			"1970-01-01",
		);
		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

	it("should throw error if family_names is empty in CicSession model", async () => {
		const cicSession = new CicSession(
			"Frederick Joseph",
			"",
			"1970-01-01",
		);

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

	it("should throw error if date_of_birth is empty in CicSession model", async () => {
		const cicSession = new CicSession(
			"Frederick Joseph",
			"Flintstone",
			"",
		);

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

	it("should throw error if date_of_birth is invalid in CicSession model", async () => {
		const cicSession = new CicSession(
			"Frederick Joseph",
			"Flintstone",
			"date_of_birth",
		);

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

});
