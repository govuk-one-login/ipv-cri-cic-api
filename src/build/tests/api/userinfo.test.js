"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apiCommonAssertions_1 = require("../../utils/apiCommonAssertions");
const apiTestSteps_1 = require("../../utils/apiTestSteps");
describe("Happy Path Post UserInfo", () => {
    let sessionId;
    let authResponse;
    let tokenResponse;
    beforeEach(async () => {
        const requestBody = {
            target: "https://unb2uhs7rl.execute-api.eu-west-2.amazonaws.com/dev/",
        };
        const stubResponse = await (0, apiTestSteps_1.stubStartPost)(requestBody);
        const sessionResponse = await (0, apiTestSteps_1.sessionPost)(stubResponse.data.clientId, stubResponse.data.request);
        sessionId = sessionResponse.data.session_id;
        await (0, apiTestSteps_1.claimedIdentityPost)("Slim", "Pickens", "1970-03-26", "brp", "2024-03-31", sessionId);
        authResponse = await (0, apiTestSteps_1.authorizationGet)(sessionId);
        tokenResponse = await (0, apiTestSteps_1.tokenPost)(authResponse.data.authorizationCode.value, authResponse.data.redirect_uri);
    });
    it("Generate jwt", async () => {
        const response = await (0, apiTestSteps_1.userInfoPost)(tokenResponse.data.access_token);
        console.log("Response XYZ", response);
        (0, apiCommonAssertions_1.assert200OK)(response.status, response.statusText);
    });
});
