import {validateOrReject} from "class-validator";
import {AppError} from "./AppError";
import { StatusCodes }from 'http-status-codes';

  export async function validateModel(model: object) {
      try {
          await validateOrReject(model, {forbidUnknownValues: true});
      } catch (errors) {
          const errorDetails = getErrors(errors);
          console.log(`${model.constructor.name}`)
          console.log("**** Error validating " + `${model.constructor.name}` + "   "+JSON.stringify(errorDetails));
          console.log(`Failed to validate data - ${model.constructor.name}`, "ValidationHelper", StatusCodes.UNPROCESSABLE_ENTITY, errorDetails);
          throw new AppError(StatusCodes.UNPROCESSABLE_ENTITY, `Failed to Validate - ${model.constructor.name}`, errorDetails);
      }
  }
    function getErrors(errors: any): any {
        return errors.map((error: any) => {
            return {
                property: error.property,
                value: error.value,
                constraints: error.constraints,
                children: error?.children, // Gets error messages from nested Objects
            };
        });
    }

