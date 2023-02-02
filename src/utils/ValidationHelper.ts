import { validateOrReject } from "class-validator";
import { AppError } from "./AppError";
import { StatusCodes } from "http-status-codes";
import { Logger } from "@aws-lambda-powertools/logger";

export class ValidationHelper {

	async validateModel(model: object, logger: Logger): Promise<void> {
		try {
			await validateOrReject(model, { forbidUnknownValues: true });
		} catch (errors) {
			const errorDetails = this.getErrors(errors);
			console.log(`${model.constructor.name}`);
			console.log("**** Error validating " + `${model.constructor.name}` + "   " + JSON.stringify(errorDetails));
			console.log(`Failed to validate data - ${model.constructor.name}`, "ValidationHelper", StatusCodes.UNPROCESSABLE_ENTITY, errorDetails);
			throw new AppError(`Failed to Validate - ${model.constructor.name}`, errorDetails, 422);
		}
	}

	private getErrors(errors: any): any {
		return errors.map((error: any) => {
			return {
				property: error.property,
				value: error.value,
				constraints: error.constraints,
				children: error?.children, // Gets error messages from nested Objects
			};
		});
	}
}
// export const validationHelperUtils = new ValidationHelper();
