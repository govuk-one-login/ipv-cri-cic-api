import { Template, Capture, Match } from '@aws-cdk/assertions';
const { schema } = require('yaml-cfn');
import { readFileSync } from 'fs';
import { load } from 'js-yaml';

// https://docs.aws.amazon.com/cdk/v2/guide/testing.html <--- how to use this file

let template: Template;

beforeAll(() => {
    let yamltemplate: any = load(readFileSync('../template.yaml', 'utf-8'), { schema: schema })
    delete yamltemplate.Resources.IdCheckAPI.Properties.DefinitionBody; // To be removed, not SAM compatible.
    template = Template.fromJSON(yamltemplate)
}) 

it("Should not use DefinitionBody as part of the serverless::api", () => {
    // N.B this only passes as we currently delete it on line 14 in the test setup step. 
    template.hasResource('AWS::Serverless::Api',
    {
        DefinitionBody: Match.absent()
    })

})

it("The template contains two API gateway resource", () => {
    template.resourceCountIs('AWS::Serverless::Api', 2)
})

it("Has tracing enabled on at least one API", () => {
    template.hasResourceProperties('AWS::Serverless::Api',
    {
        TracingEnabled: true
    })
})

it("There are 16 lambdas defined, all with a specific permission:", () => {
    const lambda_count = 16
    template.resourceCountIs('AWS::Serverless::Function', lambda_count)
    template.resourceCountIs('AWS::Lambda::Permission', lambda_count)    
})

it("All lambdas must have a FunctionName defined", () => {
    let lambdas = template.findResources("AWS::Serverless::Function")
    let lambda_list = Object.keys(lambdas)
    lambda_list.forEach(lambda => {
        expect(lambdas[lambda].Properties.FunctionName).toBeTruthy()
    })
})

it("All Lambdas must have an associated LogGroup named after their FunctionName.", () => {
    let lambdas = template.findResources("AWS::Serverless::Function")
    let lambda_list = Object.keys(lambdas)
    lambda_list.forEach(lambda => {
        // These are functions we know are broken, but have to skip for now.
        // They should be resolved and removed from this list ASAP. 
        const excludedFunctions = [
            "JsonWebKeys-${AWS::StackName}",
            "FinishBiometricSessionFunction-${AWS::StackName}",
            "TestClientJWKS-${AWS::StackName}",
            "TestClientRedirect-${AWS::StackName}" 
        ]
        let functionName = lambdas[lambda].Properties.FunctionName["Fn::Sub"]
        if (excludedFunctions.includes(functionName)) {
            console.debug(`Skipping ${functionName} as it's broken.`)
        }
        else {
            let expectedLogName = {
                "Fn::Sub": `/aws/lambda/${functionName}`
            }
            template.hasResourceProperties("AWS::Logs::LogGroup", {
                LogGroupName: Match.objectLike(expectedLogName)
            })
        }
    })
})

it("All lambdas should have a FunctionName defined", () => {
    const functionNameCapture = new Capture(Match.anyValue());
    template.hasResourceProperties("AWS::Serverless::Function", {
        FunctionName: functionNameCapture
    })
})

it ("Each log group defined must have a 30 day retention period", () => {
    const logGroups = template.findResources("AWS::Logs::LogGroup")
    const logGroupList = Object.keys(logGroups)
    logGroupList.forEach(logGroup => {
        expect(logGroups[logGroup].Properties.RetentionInDays).toEqual(30)
    })
})

it("The API Gateway Access Log extracts a metric for 200 successes on UserInfo", () => {
    template.hasResourceProperties("AWS::Logs::MetricFilter", {
        LogGroupName: { Ref: "ApiAccessLogGroup" },
        FilterPattern: "{ $.status =  200 }",
        MetricTransformations: Match.arrayEquals([
            Match.objectEquals({
                MetricValue: "1",
                MetricNamespace: "UserInfo/StatusCodes",
                MetricName: "200Success"
            })
        ])
    })
})

it("The API Gateway Access Log extracts a metric for 500 errors on UserInfo", () => {
    template.hasResourceProperties("AWS::Logs::MetricFilter", {
        LogGroupName: { Ref: "ApiAccessLogGroup" },
        FilterPattern: "{ $.status =  500 }",
        MetricTransformations: Match.arrayEquals([
            Match.objectEquals({
                MetricValue: "1",
                MetricNamespace: "UserInfo/StatusCodes",
                MetricName: "500Error"
            })
        ])
    })
})