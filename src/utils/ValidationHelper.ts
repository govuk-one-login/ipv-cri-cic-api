import { validateOrReject } from "class-validator";
import { AppError } from "./AppError";
import { Logger } from "@aws-lambda-powertools/logger";
import { HttpCodesEnum } from "./HttpCodesEnum";
import { absoluteTimeNow } from "./DateTimeUtils";


export class ValidationHelper {

	async validateModel(model: object, logger: Logger): Promise<void> {
		try {
			await validateOrReject(model, { forbidUnknownValues: true });
		} catch (errors) {
			const errorDetails = this.getErrors(errors);
			console.log(`${model.constructor.name}`);
			console.log("**** Error validating " + `${model.constructor.name}` + "   " + JSON.stringify(errorDetails));
			console.log(`Failed to validate data - ${model.constructor.name}`, "ValidationHelper", HttpCodesEnum.UNPROCESSABLE_ENTITY, errorDetails);
			throw new AppError(`Failed to Validate - ${model.constructor.name}` + errorDetails, HttpCodesEnum.UNPROCESSABLE_ENTITY);
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

	//Viveak Stuff
	isClientIdInJwtValid = (
		queryParams: APIGatewayProxyEventQueryStringParameters,
		jwtPayload: JwtPayload,
	): boolean => {
		return jwtPayload.client_id === queryParams.client_id;
	};

	isResponseTypeQueryParamValid = (
		queryParam: APIGatewayProxyEventQueryStringParameters,
	): boolean => {
		return queryParam?.response_type === "code";
	};

	isResponseTypeInJwtValid = (
		queryParam: APIGatewayProxyEventQueryStringParameters,
		jwtClaim: JwtPayload,
	): boolean => {
		return queryParam.response_type === jwtClaim.response_type;
	};

	isJwtComplete = (payload: JwtPayload): boolean => {
		const clientId = payload.client_id;
		const responseType = payload.response_type;
		const journeyId = payload.govuk_signin_journey_id;
		const { iss, sub, aud, exp, nbf, state } = payload;
		const mandatoryJwtValues = [iss, sub, aud, exp, nbf, state, clientId, responseType, journeyId];
		return !mandatoryJwtValues.some((value) => value === undefined);
	};

	isJwtExpired = (jwtPayload: JwtPayload): boolean => {
		return (jwtPayload.exp == null) || (absoluteTimeNow() > jwtPayload.exp);
	};

	isJwtNotYetValid = (jwtPayload: JwtPayload): boolean => {
		return jwtPayload.nbf == null || (absoluteTimeNow() < jwtPayload.nbf);
	};

}
