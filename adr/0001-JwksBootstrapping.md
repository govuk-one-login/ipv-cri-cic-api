# 0001 - JSON Web Key Set bootstrapping

## Status
Complete

## Decision

Option 2: Scheduled execution. 
We'll use an EventBridge schedule to generate the JSON web key set every hour on the hour.

The longer term preference is to use Custom Resources. This isn't currently possible because our L1 stack contains resources managed by DevPlatform which not include the permissions for the use of custom resources. This work has been requested and will be available once PLAT-998 is included in a release. To switch we'll need to upgrade our platform to that version.

## Context

The sharing of public keys is done via the well-known endpoint `/.well-known/jwks.json`, which hosts our public key material in a JSON Web Key Set (JWKS), an object containing a list of `keys` that match the [JSON Web Keys](https://www.rfc-editor.org/rfc/rfc7517) format. This is part of the [OIDC provider metadata](https://openid.net/specs/openid-connect-discovery-1_0-21.html#ProviderMetadata) we make available for clients.

Our implementation of this generates a jwks.json file via a lambda, and stores it in S3. We then serve that file via an S3 proxy integration in API Gateway. This minimises the cost of regenerating public key material on demand, and prevents us hitting KMS usage limits if our JWKS endpoint is under heavy usage. The drawback to this is that the initial creation of a JWKS file needs to be triggered on the redeployment of our key configuration. This is currently not automated and requires a manual trigger done by an SRE for the account. For higher environments this manual process is considered unacceptable.

## Options
### Option 1 - Custom resource trigger
Use a lambda backed custom resource to trigger the lambda on deployment events `CREATE` and `UPDATE`. 
See Documentation on [custom resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html).

### Option 2 - CRON schedule using EventBridge
Configure an EventBridge rule to run on a schedule. This rule will regenerate the file every X minutes.
See documentation on [rules configured to run on a schedule](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html).

### Option 3 - Code Deploy pipeline Post-deployment step
Use the 'AllAtOnce' DeploymentPreference and a PostTraffic Hook.
See [the developer guide for automating updates to serverless apps](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/automating-updates-to-serverless-apps.html) for details.

## Consequences
This removes manual steps in our deployment process and ensures the JWKS file we provide is kept up to date with any changes in configuration we make to the lambda which generates our JWKS.

Changes to the underlying keys will take up to 60 mins to be shown in the well-known endpoint. For a normal key rotation this is mitigated by the fact that we should always have a safe overlap period as we rotate keys. For an unplanned immediate key rotation, e.g. due to compromise, to mitigate this we may trigger the lambda manually in Production via the AWS console.