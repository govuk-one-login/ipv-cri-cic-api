"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apiCommonAssertions_1 = require("../../utils/apiCommonAssertions");
const apiTestSteps_1 = require("../../utils/apiTestSteps");
describe("Happy Path Get SessionID", () => {
    let stubResponse;
    beforeEach(async () => {
        const requestBody = {
            target: "https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
        };
        stubResponse = await (0, apiTestSteps_1.stubStartPost)(requestBody);
    });
    it("Given valid endpoint has been received", async () => {
        const response = await (0, apiTestSteps_1.sessionPost)(stubResponse.data.clientId, stubResponse.data.request);
        (0, apiCommonAssertions_1.assert200OK)(response.status, response.statusText);
    });
});
describe("UnHappy Path", () => {
    it("401 response - Empty Request in request body", async () => {
        const requestBody = {
            target: "https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
        };
        const stubResponse = await (0, apiTestSteps_1.stubStartPost)(requestBody);
        const response = await (0, apiTestSteps_1.sessionPost)(stubResponse.data.clientId, "");
        (0, apiCommonAssertions_1.assert401Unauthorized)(response.status, response.statusText);
        expect(response.data.message).toBe("Invalid request: Request failed to be decrypted");
    });
    it("400 response - Empty Client Id in request body", async () => {
        const requestBody = {
            target: "https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
        };
        const stubResponse = await (0, apiTestSteps_1.stubStartPost)(requestBody);
        const response = await (0, apiTestSteps_1.sessionPost)("", stubResponse.data.request);
        (0, apiCommonAssertions_1.assert400BadRequest)(response.status, response.statusText);
        expect(response.data).toBe("Missing client config");
    });
    it("400 response - No Request Body", async () => {
        const response = await (0, apiTestSteps_1.sessionPost)();
        (0, apiCommonAssertions_1.assert400BadRequest)(response.status, response.statusText);
        expect(response.data.message).toBe("Invalid request body");
    });
});
