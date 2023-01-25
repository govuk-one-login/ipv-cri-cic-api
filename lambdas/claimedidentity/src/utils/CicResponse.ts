export class CicResponse {
    // constructor(
    //     authorizationCode: string,
    //     redirectUri: string | undefined,
    //     state: string | undefined
    // ) {}

    constructor(data: Partial<CicResponse>) {
        this.authorizationCode = data.authorizationCode!;
        this.redirectUri = data.redirectUri;
        this.state = data.state;
    }

    authorizationCode: string;
    redirectUri?: string;
    state?: string;
}
