# F2F CRI 

## Installation

Recommended global installed packages: 

- nodejs
- nvm
- python3
- pre-commit (installed via pip3)
- sam cli

## Dependencies

Pull in the dependencies for the project by navigating to the `src` dir, and running `npm install`.

We use npm to manage dependencies, and please _do_ commit the package-lock.json file, and ensure it's up to date where possible with `npm audit`.

If you do find an outdated/vulnerable dependency, please
- raise a JIRA ticket for the delta
- open a new branch against main,
- run `npm audit --fix`
- commit and push the changed package-lock.json file
- open a PR and raise it with the Face2Face tech lead.

## AWS SAM & CloudFormation

AWS Serverless Application Model is a framework for developing, testing and deploying your solution on AWS.

Please read up on https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html for 

 - Authoring
 - Building
 - Testing & Debugging
 - Deploying
 - Monitoring

## Example scripts

The following scripts are how to get yourself up and running

### Local development

Test a function

`cd deploy; sam local invoke 'FunctionName'`

```
➜  deploy git:(fix/tidy-up) ✗ sam local invoke HelloWorldFunction
Invoking app.lambdaHandler (nodejs16.x)
Skip pulling image and use local one: public.ecr.aws/sam/emulation-nodejs16.x:rapid-1.70.0-arm64.

Mounting /Users/aloughran/Code/GDS/f2f/di-ipv-cri-cic-api/deploy/.aws-sam/build/HelloWorldFunction as /var/task:ro,delegated inside runtime container
START RequestId: 78d928d0-15a8-4054-93aa-0764268927e0 Version: $LATEST
2023-02-01T18:16:37.994Z        78d928d0-15a8-4054-93aa-0764268927e0    INFO    Hello world!
END RequestId: 78d928d0-15a8-4054-93aa-0764268927e0
REPORT RequestId: 78d928d0-15a8-4054-93aa-0764268927e0  Init Duration: 0.05 ms  Duration: 206.69 ms     Billed Duration: 207 ms Memory Size: 1024 MB    Max Memory Used: 1024 MB
{"statusCode":200,"body":"Hello world"}%    
```

Run a local api

`sam local start-api`

➜  deploy git:(fix/tidy-up) ✗ sam local start-api 
Mounting HelloWorldFunction at http://127.0.0.1:3000/hello [GET]
You can now browse to the above endpoints to invoke your functions. You do not need to restart/reload SAM CLI while working on your functions, changes will be reflected instantly/automatically. If you used sam build before running local commands, you will need to re-run sam build for the changes to be picked up. You only need to restart SAM CLI if you update your AWS SAM template
2023-02-01 18:27:39  * Running on http://127.0.0.1:3000/ (Press CTRL+C to quit)

This will then allow you to hit the API with something like curl:

```
➜  deploy git:(fix/tidy-up) ✗ curl http://127.0.0.1:3000/hello
Hello world%
```

### Tests

Unit Tests:  `npm run test:unit`
API Tests: `npm run test:api`
Infrastructure Unit Tests: `npm run test:infra`
Run tests against a CloudFormation stack deployed into AWS against your stack (use correct stack name): `run-tests-locally.sh cic-backend-api`

## .env.example

This file contains an example of the environment variables that this project requires. To use it, copy the file to `.env` and replace the values with your actual sensitive information.
To copy the file, run the following command in your terminal:

```shell
cp .env.example .env
```

Then, open the `.env` file and replace ALL the values with your actual sensitive information.
Note: The `.env` file should not be committed to the repository, as it contains sensitive information.

## Stack deployment in DEV

To deploy an individual stack in the DEV account from a local branch with full DEBUG logging in the lambdas:

```shell
cd ./deploy
sam build --parallel
sam deploy --resolve-s3 --stack-name "YOUR_STACK_NAME" --confirm-changeset --config-env dev --parameter-overrides \
  "CodeSigningConfigArn=\"none\" Environment=\"dev\" PermissionsBoundary=\"none\" SecretPrefix=\"none\" VpcStackName=\"vpc-cri\" CommonStackName=\"common-cri-api\" L2DynamoStackName=\"infra-l2-dynamo\" L2KMSStackName=\"infra-l2-kms\" PowertoolsLogLevel=\"DEBUG\""
```

# Generating JWKS

The public JWKS is not generated automatically when deploying a stack. In order to run the E2E tests, or to successfully call the ./wellknown/jwks endpoint, the key needs to be generated. It can be done as follows:

```shell
aws lambda invoke --function-name JsonWebKeys-<STACK-NAME> response.json
```
