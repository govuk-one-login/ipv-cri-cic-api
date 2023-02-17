var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { validateOrReject } from "class-validator";
import { AppError } from "./AppError";
import { HttpCodesEnum } from "./HttpCodesEnum";
export class ValidationHelper {
    validateModel(model, logger) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield validateOrReject(model, { forbidUnknownValues: true });
            }
            catch (errors) {
                const errorDetails = this.getErrors(errors);
                console.log(`${model.constructor.name}`);
                console.log("**** Error validating " + `${model.constructor.name}` + "   " + JSON.stringify(errorDetails));
                console.log(`Failed to validate data - ${model.constructor.name}`, "ValidationHelper", HttpCodesEnum.UNPROCESSABLE_ENTITY, errorDetails);
                throw new AppError(`Failed to Validate - ${model.constructor.name}` + errorDetails, HttpCodesEnum.UNPROCESSABLE_ENTITY);
            }
        });
    }
    getErrors(errors) {
        return errors.map((error) => {
            return {
                property: error.property,
                value: error.value,
                constraints: error.constraints,
                children: error === null || error === void 0 ? void 0 : error.children, // Gets error messages from nested Objects
            };
        });
    }
}
