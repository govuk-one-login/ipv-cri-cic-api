export class Constants {

    static readonly X_SESSION_ID = "x-govuk-signin-session-id";

    static readonly SESSION_ID = "session-id";

    static readonly CLAIMEDID_METRICS_SVC_NAME = "ClaimedIdentity";

    static readonly CLAIMEDID_LOGGER_SVC_NAME = "ClaimedIdHandler";

    static readonly CLAIMEDID_METRICS_NAMESPACE = "CIC-CRI";

    static readonly DEBUG = "DEBUG";

    static readonly INFO = "INFO";

    static readonly WARN = "WARN";

    static readonly ERROR = "ERROR";

    static readonly regexUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
}
