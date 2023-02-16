import { Template, Match } from '@aws-cdk/assertions'
import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { schema } from 'yaml-cfn'

// https://docs.aws.amazon.com/cdk/v2/guide/testing.html <--- how to use this file

let template: Template

beforeAll(() => {
  const yamltemplate: any = load(readFileSync('../deploy/template.yaml', 'utf-8'), { schema: schema })
  template = Template.fromJSON(yamltemplate)
})

it('Should not use DefinitionBody as part of the serverless::api', () => {
  // N.B this only passes as we currently delete it on line 14 in the test setup step.
  template.hasResource('AWS::Serverless::Api',
    {
      DefinitionBody: Match.absent()
    })
})

it('The template contains two API gateway resource', () => {
  template.resourceCountIs('AWS::Serverless::Api', 4)
})

it('Has tracing enabled on at least one API', () => {
  template.hasResourceProperties('AWS::Serverless::Api',
    {
      TracingEnabled: true
    })
})

it.skip('There are 1 lambdas defined, all with a specific permission:', () => {
  const lambdaCount = 1
  template.resourceCountIs('AWS::Serverless::Function', lambdaCount)
  template.resourceCountIs('AWS::Lambda::Permission', lambdaCount)
})

it.skip('All lambdas must have a FunctionName defined', () => {
  const lambdas = template.findResources('AWS::Serverless::Function')
  const lambdaList = Object.keys(lambdas)
  lambdaList.forEach(lambda => {
    expect(lambdas[lambda].Properties.FunctionName).toBeTruthy()
  })
})

it.skip('All Lambdas must have an associated LogGroup named after their FunctionName.', () => {
  const lambdas = template.findResources('AWS::Serverless::Function')
  const lambdaList = Object.keys(lambdas)
  lambdaList.forEach(lambda => {
    // These are functions we know are broken, but have to skip for now.
    // They should be resolved and removed from this list ASAP.
    const excludedFunctions: string[] = [
      // example if you've deployed a mistake "JsonWebKeys-${AWS::StackName}",
    ]
    const functionName: string = lambdas[lambda].Properties.FunctionName['Fn::Sub']
    if (excludedFunctions.includes(functionName)) {
      console.debug(`Skipping ${functionName} as it's broken.`)
    } else {
      const expectedLogName = {
        'Fn::Sub': `/aws/lambda/${functionName}`
      }
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: Match.objectLike(expectedLogName)
      })
    }
  })
})

it.skip('Each log group defined must have a retention period', () => {
  const logGroups = template.findResources('AWS::Logs::LogGroup')
  const logGroupList = Object.keys(logGroups)
  logGroupList.forEach(logGroup => {
    expect(logGroups[logGroup].Properties.RetentionInDays).toBeTruthy()
  })
})

describe.skip('Log group retention', () => {
  test.each`
    environment         | retention
    ${'dev'}            | ${3}
    ${'build'}          | ${3}
    ${'staging'}        | ${3}
    ${'integration'}    | ${30}
    ${'production'}     | ${30}
    `('Log group retention period for $environment has correct value in mappings', ({ environment, retention }) => {
    const mappings = template.findMappings('EnvironmentVariables')
    expect(mappings.EnvironmentVariables[environment].CWLOGRETENTIONDAYS).toBe(retention)
  })
})
