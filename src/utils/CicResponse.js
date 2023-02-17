export class CicResponse {
    constructor(data) {
        this.authorizationCode = data.authorizationCode;
        this.redirect_uri = data.redirect_uri;
        this.state = data.state;
    }
}
