import { Metrics } from "@aws-lambda-powertools/metrics";
import { mock } from "jest-mock-extended";
import { Logger } from "@aws-lambda-powertools/logger";

// arrange test data before importing the class under test
process.env.SESSION_TABLE = "";

import { UserInfoRequestProcessor } from "../../../services/UserInfoRequestProcessor";

/* eslint @typescript-eslint/unbound-method: 0 */
/* eslint jest/unbound-method: error */

const logger = mock<Logger>();
const metrics = new Metrics({ namespace: "CIC" });

describe("UserInfoRequestProcessor - invalid configuration", () => {
	it("should throw a fatal error if SESSION_TABLE not defined", () => {
		process.env.SESSION_TABLE = "";

		expect(() => {
			new UserInfoRequestProcessor(logger, metrics);
		}).toThrow("Service incorrectly configured");
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
			message: "Missing SESSION_TABLE environment variable",
			messageCode: "MISSING_CONFIGURATION",
		}));
	});
});
