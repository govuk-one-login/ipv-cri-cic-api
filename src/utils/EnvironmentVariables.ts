import { Logger } from "@aws-lambda-powertools/logger";
import { MessageCodes } from "../models/enums/MessageCodes";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "./HttpCodesEnum";

export const checkEnvironmentVariable = (variableName: string, logger: Logger): string => {
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
