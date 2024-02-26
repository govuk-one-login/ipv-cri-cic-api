export class Constants {

    static readonly X_SESSION_ID = "x-govuk-signin-session-id";

    static readonly SESSION_ID = "session-id";

    static readonly CLAIMEDID_METRICS_SVC_NAME = "ClaimedIdentity";

    static readonly CLAIMEDID_LOGGER_SVC_NAME = "ClaimedIdHandler";

    static readonly CIC_METRICS_NAMESPACE = "CIC-CRI";

    static readonly USERINFO_LOGGER_SVC_NAME = "UserInfoHandler";

    static readonly ACCESSTOKEN_LOGGER_SVC_NAME = "AccessTokenHandler";

    static readonly AUTHORIZATION_LOGGER_SVC_NAME = "AuthorizationCodeHandler";

    static readonly SESSION_CONFIG_LOGGER_SVC_NAME = "SessionConfigHandler";

    static readonly JWKS_LOGGER_SVC_NAME = "JwksHandler";

    static readonly DEBUG = "DEBUG";

    static readonly INFO = "INFO";

    static readonly WARN = "WARN";

    static readonly ERROR = "ERROR";

    static readonly BEARER = "Bearer";

    static readonly W3_BASE_CONTEXT = "https://www.w3.org/2018/credentials/v1";

    static readonly DI_CONTEXT = "https://vocab.account.gov.uk/contexts/identity-v1.jsonld";

    static readonly IDENTITY_ASSERTION_CREDENTIAL = "IdentityAssertionCredential";

    static readonly VERIFIABLE_CREDENTIAL = "VerifiableCredential";

    static readonly CODE = "code";

    static readonly REDIRECT_URL = "redirect_uri";

    static readonly GRANT_TYPE = "grant_type";

    static readonly AUTHORIZATION_CODE = "authorization_code";

    static readonly AUTHORIZATION_CODE_INDEX_NAME = "authCode-updated-index";

    static readonly TOKEN_EXPIRY_SECONDS = 3.154e+9;

    static readonly REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    static readonly GIVEN_NAME_REGEX = /^[a-zA-Z.'-]+( [a-zA-Z.'-]+)*$/;

	static readonly TXMA_FIELDS_TO_SHOW = ["event_name", "session_id", "govuk_signin_journey_id"];

    static readonly FACE_TO_FACE_JOURNEY = "FACE_TO_FACE";

    static readonly NO_PHOTO_ID_JOURNEY = "NO_PHOTO_ID";

    static readonly EXPECTED_CONTEXT = "bank_account";
    
}

export const EnvironmentVariables = {
	SESSION_TABLE: "SESSION_TABLE",
	ISSUER: "ISSUER",
	KMS_KEY_ARN: "KMS_KEY_ARN",
	ENCRYPTION_KEY_IDS: "ENCRYPTION_KEY_IDS",
	AUTH_SESSION_TTL: "AUTH_SESSION_TTL",
	CLIENT_CONFIG: "CLIENT_CONFIG",
	TXMA_QUEUE_URL: "TXMA_QUEUE_URL",
	PERSON_IDENTITY_TABLE_NAME: "PERSON_IDENTITY_TABLE_NAME",
};
