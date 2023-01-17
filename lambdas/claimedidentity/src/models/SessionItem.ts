import {IsNotEmpty, IsString, IsUUID} from "class-validator";

export class SessionItem {

    constructor(data: Partial<SessionItem> = { }) {
        this.sessionId = data.sessionId!;
        this.expiryDate = data.expiryDate;
        this.createdDate = data.createdDate;
        this.clientId = data.clientId;
        this.state = data.state;
        this.redirectUri =  data.redirectUri;
        this.authorizationCode = data.authorizationCode;
        this.authorizationCodeExpiryDate = data.authorizationCodeExpiryDate;
        this.accessToken = data.accessToken;
        this.accessTokenExpiryDate = data.accessTokenExpiryDate;
        this.subject = data.subject;
        this.persistentSessionId =data.persistentSessionId;
        this.clientSessionId = data.clientSessionId;
        this.clientIpAddress = data.clientIpAddress;
        this.attemptCount = data.attemptCount;
        this.fullName = data.fullName!;
        this.dateOfBirth = data.dateOfBirth!;
        this.documentSelected = data.documentSelected!;
        this.dateOfExpiry = data.dateOfExpiry!;
    }

    @IsString()
    @IsNotEmpty()
    @IsUUID()
    sessionId: string;

    expiryDate?: number;

    createdDate?: number;

    clientId?: string;
    state?: string;
    redirectUri?: string;
    authorizationCode?: string;
    authorizationCodeExpiryDate?: number;
    accessToken?: string;
    accessTokenExpiryDate?: number;
    subject?: string;
    persistentSessionId?: string;
    clientSessionId?: string;
    clientIpAddress?: string;
    attemptCount?: number;
    @IsString()
        //@IsNotEmpty()
    fullName?: string;

    @IsString()
        //@IsNotEmpty()
    dateOfBirth?: string;

    @IsString()
        //@IsNotEmpty()
    documentSelected?: string;

    @IsString()
        //@IsNotEmpty()
    dateOfExpiry?: string;
}
