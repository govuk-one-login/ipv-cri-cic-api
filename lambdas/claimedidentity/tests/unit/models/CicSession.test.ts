
import { ValidationHelper } from "../../../src/utils/ValidationHelper";
import {CicSession} from "../../../src/models/CicSession";
import {Logger} from "@aws-lambda-powertools/logger";

const logger = new Logger({
    logLevel: 'ERROR',
    serviceName: 'CIC'
});

describe("CicSession", () => {

    it("should validate CicSession model", async () => {
        const cicSession = new CicSession({
            fullName : "Frederick Joseph Flintstone",
            dateOfBirth: "1970-01-01",
            documentSelected: "driversPermit",
            dateOfExpiry: "1970-01-01"
        });

        await expect(new ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
    });

    it("should throw error if fullName is empty in CicSession model", async () => {
        const cicSession = new CicSession({
            fullName : "",
            dateOfBirth: "1970-01-01",
            documentSelected: "driversPermit",
            dateOfExpiry: "1970-01-01"
        });

        await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });

    it("should throw error if dateOfBirth is empty in CicSession model", async () => {
        const cicSession = new CicSession({
            fullName : "Frederick Joseph Flintstone",
            dateOfBirth: "",
            documentSelected: "driversPermit",
            dateOfExpiry: "1970-01-01"
        });

        await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });

    it("should throw error if documentSelected is empty in CicSession model", async () => {
        const cicSession = new CicSession({
            fullName : "Frederick Joseph Flintstone ",
            dateOfBirth: "1970-01-01",
            documentSelected: "",
            dateOfExpiry: "1970-01-01"
        });

        await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });

    it("should throw error if dateOfExpiry is empty in CicSession model", async () => {
        const cicSession = new CicSession({
            fullName : "Frederick Joseph Flintstone ",
            dateOfBirth: "1970-01-01",
            documentSelected: "driversPermit",
            dateOfExpiry: ""
        });

        await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });

    it("should throw error if dateOfBirth is invalid in CicSession model", async () => {
        const cicSession = new CicSession({
            fullName : "Frederick Joseph Flintstone ",
            dateOfBirth: "dateOfBirth",
            documentSelected: "driversPermit",
            dateOfExpiry: "1970-01-01"
        });

        await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });

    it("should throw error if dateOfExpiry is invalid in CicSession model", async () => {
        const cicSession = new CicSession({
            fullName : "Frederick Joseph Flintstone ",
            dateOfBirth: "1970-01-01",
            documentSelected: "driversPermit",
            dateOfExpiry: "dateOfExpiry"
        });

        await expect(new ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });
});
