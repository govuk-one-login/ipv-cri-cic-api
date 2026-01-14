# IPV Stub

If there are requirements for data contract changes between IPV Core and CRIs, then please do not use the default stack to build and deploy and instead use a different stack with similar naming convention - i.e 

``` bash
sam build && sam deploy --stack-name cic-ipv-stub-<YOUR_IDENTIFIER> --resolve-s3 
```

## Setup notes
If modifications are made to the stub and a new stack is being used, remember to update the API configuration to point your custom stack. i.e 
``` bash
sam deploy --capabilities CAPABILITY_NAMED_IAM --resolve-s3 --stack-name "<YOUR_IDENTIFIER>-cic-cri-api" --confirm-changeset --config-env dev --parameter-overrides \  "CodeSigningConfigArn=\"none\" Environment=\"dev\" PermissionsBoundary=\"none\" SecretPrefix=\"none\" VpcStackName=\"vpc-cri\" L2DynamoStackName=\"cic-cri-ddb\" L2KMSStackName=\"cic-cri-kms\" PowertoolsLogLevel=\"INFO\" IPVStubStackName=\"jb-cic-ipv-stub\""
```

## Interface

When you deploy this stack you will have access to 3 endpoints.

### Start
To start a session use the start endpoint:
```http 
POST https://ipvstub.review-c.build.account.gov.uk/start
Content-Type: application/json

{
    "clientId": "<OPTIONAL_CLIENT_ID>",
    "gov_uk_signin_journey_id": "<OPTIONAL_UNIQUE_IDENTIFIER>",
    "shared_claims": "<OPTIONAL_SHARED_CLAIMS>",
    "frontendURL": "<OPTIONAL_FRONTEND_URL>"
}
```
### Callback
The callback endpoint is the intended recipient of the consumer of the Authorization flow.
It will then simulate IPV Core using the auth code to make subsequent calls to the /token and /userinfo endpoints.
It will then return a `200` response with the VC provided the CRI was able to issue one successfully.

```http 
POST https://ipvstub.review-c.build.account.gov.uk/callback?code=ACBCADD6-10A4-49AC-B3F9-6DBC18B79B02&state=DC19A346249E679B02
Content-Type: application/json

```

### JWKs
To enable the authorization code flow to complete successfully the CRI must be able to read the public encryption key of the stub. These are made available on the stubs well-known endpoint:

```http
GET https://ipvstub.review-c.build.account.gov.uk/.well-known/jwks.json
Accept: application/json
```

## Using the stub.

### local

#### start a session using the stub

``` bash
curl --location --request POST 'https://cic-ipv-stub-ipvstub.review-c.dev.account.gov.uk/start' \
--header 'Cookie: lng=en' \
--data '{"frontendURL": "http://localhost:5020"}' 
```

This will return 6 fields:
1. request - The JWT used for the session request
2. responseType - The type of OAuth journey being performed
3. clientId - The clientId in use (Controls whether journeys are run against UAT or stubs)
4. *AuthorizeLocation* - The frontend location to kick of the journey. Navigating here in the browser will commence the CIC journey.
5. sub - Unique identifier for the journey
6. state - State of the OAuth journey

Navigating to the AuthorizeLocation endpoint in a browser will run a journey in the CIC CRI

Journey permutations for hmrc_check and bav can be accessed with the following. (By default any other journey will be F2F)

##### F2F
``` bash
curl --location --request POST 'https://cic-ipv-stub-ipvstub.review-c.dev.account.gov.uk/start' \
--header 'Cookie: lng=en' \
--data '{"frontendURL": "http://localhost:5020"}' 
```

##### bav
``` bash
curl --location --request POST 'https://cic-ipv-stub-ipvstub.review-c.dev.account.gov.uk/start' \
--header 'Cookie: lng=en' \
--data '{"frontendURL": "http://localhost:5020", "context": "bank_account"}' 
```

##### hmrc check
``` bash
curl --location --request POST 'https://cic-ipv-stub-ipvstub.review-c.dev.account.gov.uk/start' \
--header 'Cookie: lng=en' \
--data '{"frontendURL": "http://localhost:5020", "context": "hmrc_check"}' 
```

### dev

#### start a session using the stub

``` bash
curl --location --request POST 'https://cic-ipv-stub-ipvstub.review-c.dev.account.gov.uk/start' \
--header 'Cookie: lng=en' \
--data '' 
```

See above - journey remains the same across all environments

#### build

``` bash
curl --location --request POST 'https://ipvstub.review-c.build.account.gov.uk/start' \
--header 'Cookie: lng=en' \
--data ''
```

See above - journey remains the same across all environments
