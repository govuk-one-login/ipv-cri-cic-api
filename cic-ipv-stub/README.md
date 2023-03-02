# dca-test-client

To utilise the new test client for e2e tests, you need to have active AWS credentials. Follow the [technical onboading](https://govukverify.atlassian.net/wiki/spaces/DCMAW/pages/3126132805/Technical+Onboarding) instructions for this. 

The stack that represents main is dca-test-client, please do not deploy any changesets to this stack.

If there are requirements for data contract changes / relying parties, then please do not use the default stack to build and deploy and instead use a different stack with
similar naming convention - i.e sam build  && sam deploy --stack-name dca-test-client-<YOUR_IDENTIFIER>

## Setup notes
If modifications are made to the test client and a new stack is being used, do not forget to register the new client on a new BE stack to be used.

```
```
These are the new test client variables for the e2e tests that are required to be set:
TEST_CLIENT_ID_E2E
TEST_CLIENT_EXECUTE_URL

A new template.env file has been created that contains the default values for the env file.


To fetch an ssm parameter created from this stack, use the `get-ssm-test-params.sh` by passing in the key for the ssm parameter.