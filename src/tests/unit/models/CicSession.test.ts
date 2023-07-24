import { ValidationHelper } from "../../../utils/ValidationHelper";
import { CicSession } from "../../../models/CicSession";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({
	logLevel: "ERROR",
	serviceName: "CIC",
});

describe("CicSession", () => {
	it("should validate CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Flintstone",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if given_names contain . in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Fred.rick", ".Joseph"],
			family_names: "Flintstone",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if given_names contain ' in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Fred'rick", "Jos'ph"],
			family_names: "Flintstone",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if given_names contain - in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Ron-", "E-"],
			family_names: "Swanson",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if given_names are in CAPITALS in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["ANDY"],
			family_names: "Dwyer",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if given_names are in upper and lower case in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["BurT", "MacKlIN"],
			family_names: "FBI",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if family_names is joined by - in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Illidan-Stormrage",
			date_of_birth: "1970-01-01",
		});
		
		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if family_names contains ' in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Illidan'Stormrage",
			date_of_birth: "1970-01-01",
		});
		
		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if family_names contains . in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Illidan.Stormrage",
			date_of_birth: "1970-01-01",
		});
		
		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if family_names contains . and ' in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Illidan.Sto'rmrage",
			date_of_birth: "1970-01-01",
		});
		
		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if family_names contains is in CAPITALS in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "ANDUIN WRYNN",
			date_of_birth: "1970-01-01",
		});
		
		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should validate if family_names contains upper and lower case in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "GUl'dAn",
			date_of_birth: "1970-01-01",
		});
		
		await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
	});

	it("should throw error if family_names has multiple spaces in name", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Flintstone       Balboa",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

	it("should throw error if given_names is empty in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: [""],
			family_names: "Flintstone",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});
	
	it("should throw error if family_names is empty in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

	it("should throw error if family_names contains symbols in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Fla$h G#r[^-__-^]n",
			date_of_birth: "1970-01-01",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

	it("should throw error if date_of_birth is empty in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Flintstone",
			date_of_birth: "",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

	it("should throw error if date_of_birth is invalid in CicSession model", async () => {
		const cicSession = new CicSession({
			given_names: ["Frederick", "Joseph"],
			family_names: "Flintstone",
			date_of_birth: "date_of_birth",
		});

		await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
	});

});
