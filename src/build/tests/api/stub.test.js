"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apiCommonAssertions_1 = require("../../utils/apiCommonAssertions");
const apiTestSteps_1 = require("../../utils/apiTestSteps");
describe("IPV Core Stub Start point", () => {
    it("Given valid endpoint has been received", async () => {
        const requestBody = {
            target: "https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
        };
        const postResponse = await (0, apiTestSteps_1.stubStartPost)(requestBody);
        (0, apiCommonAssertions_1.assert201Created)(postResponse.status, postResponse.statusText);
    });
});
