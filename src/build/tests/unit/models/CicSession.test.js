"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ValidationHelper_1 = require("../../../utils/ValidationHelper");
const CicSession_1 = require("../../../models/CicSession");
const logger_1 = require("@aws-lambda-powertools/logger");
const logger = new logger_1.Logger({
    logLevel: "ERROR",
    serviceName: "CIC",
});
describe("CicSession", () => {
    it("should validate CicSession model", async () => {
        const cicSession = new CicSession_1.CicSession({
            given_names: ["Frederick", "Joseph"],
            family_names: ["Flintstone"],
            date_of_birth: "1970-01-01",
            document_selected: "brp",
            date_of_expiry: "1970-01-01",
        });
        await expect(new ValidationHelper_1.ValidationHelper().validateModel(cicSession, logger)).resolves.not.toThrow();
    });
    it("should throw error if given_names is empty in CicSession model", async () => {
        const cicSession = new CicSession_1.CicSession({
            given_names: [],
            family_names: ["Flintstone"],
            date_of_birth: "1970-01-01",
            document_selected: "driversPermit",
            date_of_expiry: "1970-01-01",
        });
        await expect(new ValidationHelper_1.ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });
    it("should throw error if family_names is empty in CicSession model", async () => {
        const cicSession = new CicSession_1.CicSession({
            given_names: ["Frederick", "Joseph"],
            family_names: [],
            date_of_birth: "1970-01-01",
            document_selected: "brp",
            date_of_expiry: "1970-01-01",
        });
        await expect(new ValidationHelper_1.ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });
    it("should throw error if date_of_birth is empty in CicSession model", async () => {
        const cicSession = new CicSession_1.CicSession({
            given_names: ["Frederick", "Joseph"],
            family_names: ["Flintstone"],
            date_of_birth: "",
            document_selected: "brp",
            date_of_expiry: "1970-01-01",
        });
        await expect(new ValidationHelper_1.ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });
    it("should throw error if document_selected is empty in CicSession model", async () => {
        const cicSession = new CicSession_1.CicSession({
            given_names: ["Frederick", "Joseph"],
            family_names: ["Flintstone"],
            date_of_birth: "1970-01-01",
            document_selected: "",
            date_of_expiry: "1970-01-01",
        });
        await expect(new ValidationHelper_1.ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });
    it("should throw error if date_of_expiry is empty in CicSession model", async () => {
        const cicSession = new CicSession_1.CicSession({
            given_names: ["Frederick", "Joseph"],
            family_names: ["Flintstone"],
            date_of_birth: "1970-01-01",
            document_selected: "brp",
            date_of_expiry: "",
        });
        await expect(new ValidationHelper_1.ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });
    it("should throw error if date_of_birth is invalid in CicSession model", async () => {
        const cicSession = new CicSession_1.CicSession({
            given_names: ["Frederick", "Joseph"],
            family_names: ["Flintstone"],
            date_of_birth: "date_of_birth",
            document_selected: "brp",
            date_of_expiry: "1970-01-01",
        });
        await expect(new ValidationHelper_1.ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });
    it("should throw error if date_of_expiry is invalid in CicSession model", async () => {
        const cicSession = new CicSession_1.CicSession({
            given_names: ["Frederick", "Joseph"],
            family_names: ["Flintstone"],
            date_of_birth: "1970-01-01",
            document_selected: "brp",
            date_of_expiry: "date_of_expiry",
        });
        await expect(new ValidationHelper_1.ValidationHelper().validateModel(cicSession, logger)).rejects.toThrow();
    });
});
