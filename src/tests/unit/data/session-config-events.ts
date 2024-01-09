export const VALID_SESSIONCONFIG = {
	httpMethod: "GET",
	body: "",
	headers: { "x-govuk-signin-session-id": "732075c8-08e6-4b25-ad5b-d6cb865a18e5" },
	isBase64Encoded: false,
	multiValueHeaders: {},
	multiValueQueryStringParameters: {},
	path: "/session-config",
	pathParameters: {},
	queryStringParameters: {},
	requestContext: {
		accountId: "",
		apiId: "",
		authorizer: {},
		httpMethod: "get",
		identity: {
			accessKey: "",
			accountId: "",
			apiKey: "",
			apiKeyId: "",
			caller: "",
			clientCert: {
				clientCertPem: "",
				issuerDN: "",
				serialNumber: "",
				subjectDN: "",
				validity: { notAfter: "", notBefore: "" },
			},
			cognitoAuthenticationProvider: "",
			cognitoAuthenticationType: "",
			cognitoIdentityId: "",
			cognitoIdentityPoolId: "",
			principalOrgId: "",
			sourceIp: "",
			user: "",
			userAgent: "",
			userArn: "",
		},
		path: "/session-config",
		protocol: "HTTP/1.1",
		requestId: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
		requestTimeEpoch: 1428582896000,
		resourceId: "123456",
		resourcePath: "/session-config",
		stage: "dev",
	},
	resource: "/session-config",
	stageVariables: {},
};

export const INVALID_SESSION_ID = {
	...VALID_SESSIONCONFIG,
	headers: { "x-govuk-signin-session-id": "invalid" },
};

export const MISSING_SESSION_ID = {
	...VALID_SESSIONCONFIG,
	headers: { },
};
