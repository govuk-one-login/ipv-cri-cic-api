"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apiCommonAssertions_1 = require("../../utils/apiCommonAssertions");
const apiTestSteps_1 = require("../../utils/apiTestSteps");
describe("Happy Path Get WellKnown", () => {
    it("Check wellKnown", async () => {
        const response = await (0, apiTestSteps_1.wellKnownGet)();
        (0, apiCommonAssertions_1.assert200OK)(response.status, response.statusText);
    });
});
