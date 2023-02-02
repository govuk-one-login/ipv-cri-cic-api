import { IsNotEmpty, IsNumber, IsString, IsUUID } from "class-validator";

export class SessionItem {
	constructor(data: Partial<SessionItem> = {}) {
		this.sessionId = data.sessionId!;
		this.clientId = data.clientId!;
		this.clientSessionId = data.clientSessionId!;
		this.redirectUri = data.redirectUri!;
		this.authorizationCodeExpiryDate = data.authorizationCodeExpiryDate!;
		this.accessToken = data.accessToken!;
		this.accessTokenExpiryDate = data.accessTokenExpiryDate!;
		this.expiryDate = data.expiryDate!;
		this.createdDate = data.createdDate!;
		this.state = data.state!;
		this.authorizationCode = data.authorizationCode!;
		this.subject = data.subject!;
		this.persistentSessionId = data.persistentSessionId!;
		this.clientIpAddress = data.clientIpAddress!;
		this.attemptCount = data.attemptCount!;
		this.fullName = data.fullName;
		this.dateOfBirth = data.dateOfBirth;
		this.documentSelected = data.documentSelected;
		this.dateOfExpiry = data.dateOfExpiry;
	}

    @IsString()
    @IsNotEmpty()
    @IsUUID()
    sessionId: string;

    @IsString()
    @IsNotEmpty()
    clientId: string;

    @IsString()
    @IsNotEmpty()
    clientSessionId: string;

    @IsUUID()
    authorizationCode?: string;

    @IsNumber()
    @IsNotEmpty()
    authorizationCodeExpiryDate: number;

    @IsString()
    @IsNotEmpty()
    redirectUri: string;

    @IsString()
    @IsNotEmpty()
    accessToken: string;

    @IsNumber()
    @IsNotEmpty()
    accessTokenExpiryDate: number;

    @IsNumber()
    @IsNotEmpty()
    expiryDate: number;

    @IsNumber()
    @IsNotEmpty()
    createdDate: number;

    @IsString()
    @IsNotEmpty()
    state: string;

    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsString()
    @IsNotEmpty()
    persistentSessionId: string;

    @IsString()
    @IsNotEmpty()
    clientIpAddress: string;

    @IsNumber()
    @IsNotEmpty()
    attemptCount: number;

    @IsString()
    fullName?: string;

    @IsString()
    dateOfBirth?: string;

    @IsString()
    documentSelected?: string;

    @IsString()
    dateOfExpiry?: string;
}
