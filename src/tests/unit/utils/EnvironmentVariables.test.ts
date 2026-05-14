import { mockLogger as logger, mockPowertoolsLogger} from "../helpers/mockPowertoolsLogger";
mockPowertoolsLogger();

import { MessageCodes } from "../../../models/enums/MessageCodes";
import { checkEnvironmentVariable } from "../../../utils/EnvironmentVariables";
import { HttpCodesEnum } from "../../../utils/HttpCodesEnum";

describe("EnvironmentVariables.test", () => {
	describe("#checkEnvironmentVariable", () => {
		it("returns value if it is valid", () => {
			expect(checkEnvironmentVariable("REGION")).toBe("eu-west-2");
		});

		it("logs and throws error if variable is not valid", () => {
			const checkUnknownVariable = () => { 
				checkEnvironmentVariable("UNKNOWN");
			};
			expect(checkUnknownVariable).toThrow(expect.objectContaining({
				statusCode: HttpCodesEnum.SERVER_ERROR,
				message: "Service incorrectly configured",
			}));
			expect(logger.error).toHaveBeenCalledWith({
  			message: "Missing UNKNOWN environment variable",
  			messageCode: MessageCodes.MISSING_CONFIGURATION,
  		});
		});
	});
});
