import { Response, GenericServerError, UnauthorizedResponse, SuccessSessionResponse, UnauthorizedResponseWithRedirect } from "../utils/Response";
import { CicService } from "./CicService";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { randomUUID } from "crypto";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { ValidationHelper } from "../utils/ValidationHelper";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { KmsJwtAdapter } from "../utils/KmsJwtAdapter";
import { GcmDecryptor } from "../utils/jwe/adapters/GcmDecryptor";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
import { VerifiableCredentialService } from "../utils/VerifiableCredentialService";
import { RsaDecryptor } from "../utils/jwe/adapters/RsaDecryptor";
import { JweDecryptor } from "../utils/jwe/JweDecryptor";
import { KmsPublicKeyGetter } from "../utils/jwe/PublicKeyGetter";
import { JwksJwtAdapter } from "../utils/jwe/JwksJwtAdapter";

const config = {
	CLIENT_CONFIG: process.env.CLIENT_CONFIG || [],
	AUTH_SESSION_TTL: parseInt(process.env.AUTH_SESSION_TTL || '0', 10),
	ISSUER: process.env.ISSUER,
	SESSION_TABLE: process.env.SESSION_TABLE,
	KMS_KEY_ARN: process.env.KMS_KEY_ARN,
	ENCRYPTION_KEY_IDS: process.env.ENCRYPTION_KEY_IDS
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

export class SessionRequestProcessor {
	private static instance: SessionRequestProcessor;

	private readonly logger: Logger;

	private readonly metrics: Metrics;

	private readonly validationHelper: ValidationHelper;

	private readonly cicService: CicService;

	private readonly kmsJwtAdapter: KmsJwtAdapter;

	constructor(logger: Logger, metrics: Metrics) {
		if (!config.SESSION_TABLE) {
			logger.error("Environment variable SESSION_TABLE is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR );
		}
		if (!config.KMS_KEY_ARN) {
			logger.error("Environment variable KMS_KEY_ARN is not configured");
			throw new AppError("Service incorrectly configured", HttpCodesEnum.SERVER_ERROR );
		}
		this.logger = logger;
		this.validationHelper = new ValidationHelper();
		this.metrics = metrics;

		logger.debug("metrics is  " + JSON.stringify(this.metrics));
		this.metrics.addMetric("Called", MetricUnits.Count, 1);
		this.cicService = CicService.getInstance(config.SESSION_TABLE, this.logger, createDynamoDbClient());
		this.kmsJwtAdapter = new KmsJwtAdapter(config.KMS_KEY_ARN);
	}

	static getInstance(logger: Logger, metrics: Metrics): SessionRequestProcessor {
		if (!SessionRequestProcessor.instance) {
			SessionRequestProcessor.instance = new SessionRequestProcessor(logger, metrics);
		}
		return SessionRequestProcessor.instance;
	}

	async processRequest(event: APIGatewayProxyEvent): Promise<Response> {

		let ipAddress, client, jwksEndpoint;

		if (event.headers['x-govuk-signin-source-ip'] == null || event.headers['x-govuk-signin-source-ip'] === undefined) {
			this.logger.error('SOURCE_IP_MISSING', {
				fieldName: 'sourceIp',
				value: ipAddress,
				reason: 'Undefined sourceIp'
			})
		} else {
			ipAddress = event.headers['x-govuk-signin-source-ip']
		}

		const clientId = event.queryStringParameters.client_id;

		if (clientId == null) {
			this.logger.error('INVALID_REQUEST', {
				fieldName: 'clientId',
				value: clientId,
				reason: 'Empty ClientID'
			})
			return UnauthorizedResponse('Invalid request: Missing clientID')
		}

		const configClient = JSON.parse(config.CLIENT_CONFIG).find(c => c.clientId === clientId)

		if (configClient === undefined) {
			this.logger.error('UNREGISTERED_CLIENT_ID', {
				fieldName: 'clientId',
				value: clientId,
				reason: 'clientId is not registered'
			})
			return UnauthorizedResponse(`Invalid request: Client Id not registered ${clientId}`)
		}

		if (configClient.jwksEndpoint == null) {
			this.logger.error('INVALID_ENVIRONMENT_VARIABLE', { envVar: 'clients.jwksEndpoint' })
			return GenericServerError
		}

		if (configClient.redirectUri == null) {
			this.logger.error('INVALID_ENVIRONMENT_VARIABLE', { envVar: 'clients.redirectUri' })
			return GenericServerError
		}

		try { jwksEndpoint = new URL(configClient.jwksEndpoint) } catch (error) {
			this.logger.error('INVALID_ENVIRONMENT_VARIABLE', { envVar: 'clients.jwksEndpoint', value: configClient.jwksEndpoint })
			return GenericServerError
		}
		client = {
			clientId,
			redirectUri: configClient.redirectUri,
			jwksEndpoint
		}

		if (event.queryStringParameters.request_uri != null) {
			this.logger.error('INVALID_REQUEST', {
				fieldName: 'request_uri',
				value: event.queryStringParameters.request_uri,
				reason: 'request uri is not expected to be present'
			})
			return UnauthorizedResponse('Invalid request: Request uri not supported')
		}

		const requestJwe = event.queryStringParameters.request ?? null
		if (requestJwe === null) {
			this.logger.error('INVALID_REQUEST', {
				fieldName: 'request_jwe',
				value: requestJwe,
				reason: 'request jwe is undefined or null'
			})
			return UnauthorizedResponse('Invalid request: Missing request query parameter')
		}

		//IT BEGINS
		let urlEncodedJwt;
		try { 
			const gcmAdapter = new GcmDecryptor();
			console.log('gcmAdapter', gcmAdapter);
			console.log('config.ENCRYPTION_KEY_IDS', config.ENCRYPTION_KEY_IDS);
			const kmsAdapter = new KmsJwtAdapter(config.ENCRYPTION_KEY_IDS);
			console.log('kmsAdapter', kmsAdapter);
			const rsaDecryptorAdapter = new RsaDecryptor(kmsAdapter);
			console.log('rsaDecryptorAdapter', rsaDecryptorAdapter);
			const jweDecryptor = new JweDecryptor(rsaDecryptorAdapter, gcmAdapter);
			console.log('jweDecryptor', jweDecryptor);
			urlEncodedJwt = await jweDecryptor.decrypt(requestJwe)
			console.log('urlEncodedJwt', urlEncodedJwt);
		} catch (error) {
			this.logger.debug('FAILED_DECRYPTING_JWE', {error})
		}

		const PublicKeyGetter = new KmsPublicKeyGetter();
		const keyGetter = await PublicKeyGetter.getPublicKey((client.jwksEndpoint).toString());
		console.log('keyGetter', keyGetter);
		const jwtAdapter = new JwksJwtAdapter(PublicKeyGetter);
		console.log('jwtAdapter', jwtAdapter);
		let parsedJwt;

		try {
			parsedJwt = jwtAdapter.decode(urlEncodedJwt)
			console.log('parsedJwt', parsedJwt);
		} catch (error) {
			this.logger.debug('FAILED_DECODING_JWT', { error: error })
		}

		

		const jwtPayload = {
			exp:1708954462,
			iat:1648562707,
			nbf:1648562707,
			aud:"https://f2f.cri.account.gov.uk/",
			iss:"https://ipv.core.account.gov.uk",
			sub:"urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
			response_type:"code",
			client_id:"cd2cc8b5-304a-46e8-9b04-0e90438c18be",
			redirect_uri:"https://www.review-b.build.account.gov.uk/stub/callback",
			state:"af0ifjsldkj",
			govuk_signin_journey_id: "govuk_signin_journey_id",
			shared_claims:{
				 name:[
						{
							 nameParts:[
									{
										 value:"Frederick",
										 type:"GivenName"
									},
									{
										 value:"Joseph",
										 type:"GivenName"
									},
									{
										 value:"Flintstone",
										 type:"FamilyName"
									}
							 ]
						}
				 ],
				 birthDate:[
						{
							 value:"1960-02-02"
						}
				 ]
			}
	 }

		const redirectUri = jwtPayload.redirect_uri ?? null
		if (redirectUri === null) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'redirect_uri',
				value: redirectUri,
				reason: 'Missing required value redirect_uri in jwt'
			})
			return UnauthorizedResponse('Invalid request: Missing redirect uri')
		}

		const state = jwtPayload.state ?? null
		if (state === null) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwtPayload.state',
				value: state,
				reason: 'Missing state in jwt'
			})
			return GenericServerError
		}

		if (redirectUri !== client.redirectUri) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwt redirect_uri',
				value: redirectUri,
				reason: 'JWT claims did not include a valid redirect_uri'
			})
			return UnauthorizedResponse('Invalid request: Redirect uri not registered')
		}

		if (!(this.validationHelper.isJwtComplete(jwtPayload))) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwt payload keys',
				value: Object.keys(jwtPayload),
				reason: 'Missing fields in jwt'
			})
			return UnauthorizedResponseWithRedirect({
				jwtPayload,
				error: 'invalid_request',
				errorDescription: 'Missing fields in jwt'
			}
			)
		}

		if (!(this.validationHelper.isClientIdInJwtValid(event.queryStringParameters, jwtPayload))) {
			this.logger.error('INVALID_DECODED_JWT', {
				fieldName: 'jwt and queryParam clientId',
				value: { jwt: jwtPayload.client_id, queryParam: event.queryStringParameters.client_id },
				reason: 'Value in JWT does not match query params'
			})
			return UnauthorizedResponseWithRedirect({
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
			return UnauthorizedResponseWithRedirect({
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
			return UnauthorizedResponseWithRedirect({
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
			return UnauthorizedResponseWithRedirect({
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
			return UnauthorizedResponseWithRedirect({
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
				return GenericServerError
			}
		} catch (err) {
			this.logger.error('UNEXPECTED_ERROR_SESSION_EXISTS', { error: err })
			return GenericServerError
		}
		// Check in DynamoDB if session exists TXMA Event -- END

		const session = {
			authSessionId: sessionId,
			authSessionState: 'CIC_SESSION_CREATED',
			subjectIdentifier: jwtPayload.sub ?? '',
			redirectUri: jwtPayload.redirect_uri,
			issuer: jwtPayload.iss ?? '',
			timeToLive: absoluteTimeNow() + config.AUTH_SESSION_TTL,
			issuedOn: Date.now(),
			state: jwtPayload.state,
			clientId: jwtPayload.client_id,
			journeyId: jwtPayload.govuk_signin_journey_id,
			clientIpAddress: ipAddress,
			biometricSessionId: '',
			abortReason: '',
			expiryDate: Date.now() + config.AUTH_SESSION_TTL * 1000,
		}

		// Add session to DynamoDB -- START
		try {
			await await this.cicService.createAuthSession(session);
		} catch (error) {
			this.logger.error('FAILED_CREATING_SESSION', { error: error })
			return GenericServerError
		}
		// Add session to DynamoDB -- END

		// Send event to SQS -- START
		const buildCoreEventFieldsMessage = buildCoreEventFields(session, config.ISSUER, ipAddress);

		const txmaData = {
			event_name: 'CIC_CRI_START',
			buildCoreEventFieldsMessage
		}

		try {
			await await this.cicService.sendToTXMA(JSON.stringify(txmaData));
		} catch (error) {
			this.logger.error('FAILED_TO_WRITE_TXMA', {
				session,
				issues: config.ISSUER,
				reason: 'Auth session successfully created. Failed to send DCMAW_CRI_START event to TXMA',
				error
			})
			return GenericServerError
		}
		// Send event to SQS -- END

		this.logger.info('COMPLETED')
		return SuccessSessionResponse(session.authSessionId, state, redirectUri)
	}
}