import { logger } from "@govuk-one-login/cri-logger";
import { MessageCodes } from "../models/enums/MessageCodes";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "./HttpCodesEnum";

export const checkEnvironmentVariable = (variableName: string): string => {
	const variableValue = process.env[variableName];
	if (variableValue) {
		return variableValue;
	} else {
		logger.error({
			message: `Missing ${variableName} environment variable`,
			messageCode: MessageCodes.MISSING_CONFIGURATION,
		});
		throw new AppError(HttpCodesEnum.SERVER_ERROR, "Service incorrectly configured",);
	}
};
