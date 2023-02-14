import { CicSession } from "../models/CicSession";
import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { randomUUID } from "crypto";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { CicResponse } from "../utils/CicResponse";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { createSQSClient } from "../utils/SQS";
import { VerifiableCredentialService } from "../vendor/VerifiableCredentialService";

const SESSION_TABLE = process.env.SESSION_TABLE;

//TODO: Update with values
const config = {
	CLIENTS: [],
	AUTH_SESSION_TTL: 20,
	ENCRYPTION_KEY_IDS: 123,
	ISSUER: '1234'
}


const SECURITY_HEADERS = {
	'Cache-Control': 'no-store',
	'Content-Type': 'application/json',
	'Strict-Transport-Security': 'max-age=31536000',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY'
}

const genericServerError: APIGatewayProxyResult = {
	statusCode: HttpCodesEnum.SERVER_ERROR,
	headers: SECURITY_HEADERS,
	body: 'Internal server error'
}

//TODO: Include full name and DOB from shared_claims (Optional)
const successResponse = (sessionId: string, state: string): APIGatewayProxyResult => {
	return {
		statusCode: HttpCodesEnum.OK,
		headers: SECURITY_HEADERS,
		body: JSON.stringify({
			sessionId,
			state
		})
	}
}

const unauthorizedResponse = (errorDescription: string): APIGatewayProxyResult => {
	return {
		statusCode: HttpCodesEnum.UNAUTHORIZED,
		headers: SECURITY_HEADERS,
		body: JSON.stringify({
			redirect: null,
			message: errorDescription
		})
	}
}

const buildCoreEventFields = (session: IFullAuthSession, issuer: string, sourceIp?: string | undefined, getNow: () => number = absoluteTimeNow): BaseTxmaEvent => {
	return {
		user: {
			user_id: session.subjectIdentifier,
			transaction_id: session.biometricSessionId,
			session_id: session.authSessionId,
			govuk_signin_journey_id: session.journeyId,
			ip_address: sourceIp
		},
		client_id: session.clientId,
		timestamp: getNow(),
		component_id: issuer
	}
}

const unauthorizedResponseWithRedirect = (params:
	{
		errorDescription: string
		error: string
		jwtPayload: JwtPayload
	}
): APIGatewayProxyResult => {
	const { error, errorDescription } = params
	const redirectUri: string = params.jwtPayload?.redirect_uri ?? null
	const state: string = params.jwtPayload?.state ?? null
	if (redirectUri === null) {
		return genericServerError
	} else {
		return {
			statusCode: HttpCodesEnum.UNAUTHORIZED,
			headers: SECURITY_HEADERS,
			body: JSON.stringify({
				redirect: `${redirectUri}?error=${error}&error_description=${encodeURIComponent(errorDescription)}&state=${state}`,
				message: errorDescription
			})
		}
	}
}

const getClientInfo = (clientId: string, redirectUri: string, jwksEndpoint: URL): { clientId: string, redirectUri: string, jwksEndpoint: URL } => {
	return {
		clientId,
		redirectUri,
		jwksEndpoint
	}
}

export class SessionRequestProcessor {
	private static instance: SessionRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly cicService: CicService;

	private readonly verifiableCredentialService: VerifiableCredentialService;

	constructor(logger: Logger, metrics: Metrics) {
		if (!SESSION_TABLE) {
			logger.error("Environment variable SESSION_TABLE is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR);
		}
		this.logger = logger;
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;

		logger.debug("metrics is  " + JSON.stringify(this.metrics));
		this.metrics.addMetric("Called", MetricUnits.Count, 1);
		this.cicService = CicService.getInstance(SESSION_TABLE, this.logger, createDynamoDbClient(), createSQSClient());
		this.verifiableCredentialService = VerifiableCredentialService.getInstance(SESSION_TABLE, this.logger);
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionRequestProcessor {
		if (!SessionRequestProcessor.instance) {
			SessionRequestProcessor.instance = new SessionRequestProcessor(logger, metrics);
		}
		return SessionRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {
		//Check if query params present
		if (event.queryStringParameters === null || Object.keys(event.queryStringParameters).length === 0) {
			this.logger.error('INVALID_REQUEST', {
				fieldName: 'queryParams',
				value: '',
				reason: 'No query string params present'
			})
			return unauthorizedResponse('Invalid request: No query string params')
		}

		//Set IPaddress
		let ipAddress
		if (event.headers['x-govuk-signin-source-ip'] == null || event.headers['x-govuk-signin-source-ip'] === undefined) {
			this.logger.error('SOURCE_IP_MISSING', {
				fieldName: 'sourceIp',
				value: ipAddress,
				reason: 'Undefined sourceIp'
			})
		} else {
			ipAddress = event.headers['x-govuk-signin-source-ip']
		}

		//Set Client
		let client
		const clientId = event.queryStringParameters.client_id
		if (clientId == null) {
			this.logger.error('INVALID_REQUEST', {
				fieldName: 'clientId',
				value: clientId,
				reason: 'Empty ClientID'
			})
			return unauthorizedResponse('Invalid request: Missing clientID')
		}

		const configClient = config.CLIENTS.find(c => c.clientId === clientId)

		if (configClient === undefined) {
			this.logger.error('UNREGISTERED_CLIENT_ID', {
				fieldName: 'clientId',
				value: clientId,
				reason: 'clientId is not registered'
			})
			return unauthorizedResponse(`Invalid request: Client Id not registered ${clientId}`)
		}

		if (configClient.jwksEndpoint == null) {
			this.logger.error('INVALID_ENVIRONMENT_VARIABLE', { envVar: 'clients.jwksEndpoint' })
			return genericServerError
		}

		if (configClient.redirectUri == null) {
			this.logger.error('INVALID_ENVIRONMENT_VARIABLE', { envVar: 'clients.redirectUri' })
			return genericServerError
		}

		let jwksEndpoint
		try { jwksEndpoint = new URL(configClient.jwksEndpoint) } catch (error) {
			this.logger.error('INVALID_ENVIRONMENT_VARIABLE', { envVar: 'clients.jwksEndpoint', value: configClient.jwksEndpoint })
			return genericServerError
		}
		client = getClientInfo(clientId, configClient.redirectUri, jwksEndpoint)

		//Check for Request URI
		if (event.queryStringParameters.request_uri != null) {
			this.logger.error('INVALID_REQUEST', {
				fieldName: 'request_uri',
				value: event.queryStringParameters.request_uri,
				reason: 'request uri is not expected to be present'
			})
			return unauthorizedResponse('Invalid request: Request uri not supported')
		}

		//Check for Request JWE
		const requestJwe = event.queryStringParameters.request ?? null
		if (requestJwe === null) {
			this.logger.error('INVALID_REQUEST', {
				fieldName: 'request_jwe',
				value: requestJwe,
				reason: 'request jwe is undefined or null'
			})
			return unauthorizedResponse('Invalid request: Missing request query parameter')
		}

		// Decryption -- START
		let urlEncodedJwt
		try {
			
			const gcmAdapter = dependencies.getGCMAdapter()
			const kmsAdapter = dependencies.getKmsJwtAdapter(config.ENCRYPTION_KEY_IDS)
			const rsaDecryptorAdapter = dependencies.getRSADecryptorAdapter(kmsAdapter)
			//Viveak JWE
			const jweDecryptor = dependencies.getJWEDecryptor(rsaDecryptorAdapter, gcmAdapter)
			urlEncodedJwt = await jweDecryptor.decrypt(requestJwe)
		} catch (error) {
			this.logger.error('FAILED_DECRYPTING_JWE', {})
			return unauthorizedResponse('Invalid request: Request failed to be decrypted')
		}
		const keyGetter = dependencies.getJwksPublicKeyGetter(client.jwksEndpoint)
		const jwtAdapter = dependencies.getJwksJwtAdapter(keyGetter)
		let parsedJwt: Jwt
		try {
			parsedJwt = jwtAdapter.decode(urlEncodedJwt)
		} catch (error) {
			this.logger.error('FAILED_DECODING_JWT', { error: error })
			return unauthorizedResponse('Invalid request: Rejected jwt')
		}
		// Decryption -- END

		// Payload Verification -- START
		const jwtPayload = parsedJwt.payload
		try {
			const isValidJws = await jwtAdapter.verify(urlEncodedJwt)
			if (!isValidJws) {
				this.logger.error('FAILED_VERIFYING_JWT', {})
				return unauthorizedResponse('Invalid request: Invalid signature')
			}
		} catch (error) {
			this.logger.error('UNEXPECTED_ERROR_VERIFYING_JWT', { error: error })
			return unauthorizedResponse('Invalid request: Could not verify jwt')
		}
		// Payload Verification -- END

		// Payload Validation -- START
		const journeyId = jwtPayload.govuk_signin_journey_id ?? null
		if (journeyId === null) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'govuk_signin_journey_id',
				value: journeyId,
				reason: 'Missing journey ID in jwt'
			})
		} else {
			logger.setSessionData({ journeyId: journeyId, biometricSessionId: '', authSessionId: '' })
		}
		const redirectUri = jwtPayload.redirect_uri ?? null
		if (redirectUri === null) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'redirect_uri',
				value: redirectUri,
				reason: 'Missing required value redirect_uri in jwt'
			})
			return unauthorizedResponse('Invalid request: Missing redirect uri')
		}

		const state = jwtPayload.state ?? null
		if (state === null) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwtPayload.state',
				value: state,
				reason: 'missing state in jwt'
			})
			return genericServerError
		}

		if (redirectUri !== client.redirectUri) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwt redirect_uri',
				value: redirectUri,
				reason: 'JWT claims did not include a valid redirect_uri'
			})
			return unauthorizedResponse('Invalid request: Redirect uri not registered')
		}

		if (!(this.validationHelper.isJwtComplete(jwtPayload))) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwt payload keys',
				value: Object.keys(jwtPayload),
				reason: 'missing fields in jwt'
			})
			return unauthorizedResponseWithRedirect({
				jwtPayload,
				error: 'invalid_request',
				errorDescription: 'missing fields in jwt'
			}
			)
		}

		if (!(this.validationHelper.isClientIdInJwtValid(event.queryStringParameters, jwtPayload))) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwt and queryParam clientId',
				value: { jwt: jwtPayload.client_id, queryParam: event.queryStringParameters.client_id },
				reason: 'Value in JWT does not match query params'
			})
			return unauthorizedResponseWithRedirect({
				jwtPayload,
				error: 'invalid_request',
				errorDescription: 'invalid client_id in jwt'
			})
		}

		if (!(this.validationHelper.isResponseTypeQueryParamValid(event.queryStringParameters))) {
			this.logger.error('INVALID_REQUEST', {
				fieldName: 'response type',
				value: event.queryStringParameters.response_type,
				reason: 'Invalid response_type in query params'
			})
			return unauthorizedResponseWithRedirect({
				jwtPayload,
				error: 'unsupported_response_type',
				errorDescription: 'invalid response_type in query params'
			})
		}

		if (!(this.validationHelper.isResponseTypeInJwtValid(event.queryStringParameters, jwtPayload))) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwt response_type',
				value: jwtPayload.response_type,
				reason: 'Invalid response_type in jwt'
			})
			return unauthorizedResponseWithRedirect({
				jwtPayload,
				error: 'invalid_request',
				errorDescription: 'invalid response_type in jwt'
			})
		}

		if (this.validationHelper.isJwtNotYetValid(jwtPayload)) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwt payload - nbf',
				value: jwtPayload.nbf,
				reason: 'jwt not yet valid'
			})
			return unauthorizedResponseWithRedirect({
				jwtPayload,
				error: 'invalid_request',
				errorDescription: 'jwt not yet valid'
			})
		}

		if (this.validationHelper.isJwtExpired(jwtPayload)) {
			this.logger.error('EXPIRED_JWT', {
				fieldName: 'jwt payload - exp',
				value: jwtPayload.exp,
				reason: 'jwt has expired'
			})
			return unauthorizedResponseWithRedirect({
				jwtPayload,
				error: 'invalid_request',
				errorDescription: 'expired jwt'
			})
		}
		// Payload Validation -- END

		// Check in DynamoDB if session exists TXMA Event -- START
		const sessionId: string = randomUUID()
		try {
			if (await this.cicService.getSessionById(sessionId)) {
				this.logger.error('SESSION_ALREADY_EXISTS', { fieldName: 'sessionId', value: sessionId, reason: 'sessionId already exists in the database' })
				return genericServerError
			}
		} catch (err) {
			this.logger.error('UNEXPECTED_ERROR_SESSION_EXISTS', { error: err })
			return genericServerError
		}
		// Check in DynamoDB if session exists TXMA Event -- END

		const session: IFullAuthSession = {
			authSessionId: sessionId,
			authSessionState: 'AUTH_SESSION_CREATED',
			subjectIdentifier: jwtPayload.sub ?? '',
			redirectUri: jwtPayload.redirect_uri,
			issuer: jwtPayload.iss ?? '',
			timeToLive: absoluteTimeNow() + config.AUTH_SESSION_TTL,
			issuedOn: Date.now(),
			state: jwtPayload.state,
			clientId: jwtPayload.client_id,
			journeyId: jwtPayload.govuk_signin_journey_id,
			biometricSessionId: '',
			abortReason: ''
		}

		// Add session to DynamoDB -- START
		try {
			await await this.cicService.createAuthSession(session);
		} catch (error) {
			this.logger.error('FAILED_CREATING_SESSION', { error: error })
			return genericServerError
		}
		// Add session to DynamoDB -- END



		const issuer = config.ISSUER;
		const buildCoreEventFieldsMessage = buildCoreEventFields(session, issuer, ipAddress);

		const txmaData = {
			event_name: 'DCMAW_CRI_START',
			buildCoreEventFieldsMessage
		}

		try {
			await await this.cicService.sendToTXMA(JSON.stringify(txmaData));
		} catch (error) {
			this.logger.error('FAILED_TO_WRITE_TXMA', {
				session,
				issuer,
				reason: 'Auth session successfully created. Failed to send DCMAW_CRI_START event to TXMA',
				error
			})
			return genericServerError
		}

		// logger.setSessionData({ journeyId: jwtPayload.govuk_signin_journey_id, biometricSessionId: '', authSessionId: session.authSessionId })
		this.logger.info('COMPLETED')
		return successResponse(session.authSessionId, state)
	}
}
