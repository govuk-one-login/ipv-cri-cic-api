"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apiCommonAssertions_1 = require("../../utils/apiCommonAssertions");
const apiTestSteps_1 = require("../../utils/apiTestSteps");
describe("Happy Path Post Token", () => {
    let sessionId;
    let authResponse;
    beforeEach(async () => {
        const requestBody = {
            target: "https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
        };
        const stubResponse = await (0, apiTestSteps_1.stubStartPost)(requestBody);
        const sessionResponse = await (0, apiTestSteps_1.sessionPost)(stubResponse.data.clientId, stubResponse.data.request);
        sessionId = sessionResponse.data.session_id;
        await (0, apiTestSteps_1.claimedIdentityPost)("Slim", "Pickens", "1970-03-26", "brp", "2024-03-31", sessionId);
        authResponse = await (0, apiTestSteps_1.authorizationGet)(sessionId);
    });
    it("Exchange an Authorization Code for an Access Token", async () => {
        const response = await (0, apiTestSteps_1.tokenPost)(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri);
        (0, apiCommonAssertions_1.assert201Created)(response.status, response.statusText);
    });
});
