import { Template, Capture, Match } from "@aws-cdk/assertions";
import { readFileSync } from "fs";
import { load } from "js-yaml";
const { schema } = require("yaml-cfn");

// https://docs.aws.amazon.com/cdk/v2/guide/testing.html <--- how to use this file

let template: Template;

beforeAll(() => {
  const yamltemplate: any = load(
    readFileSync("../deploy/template.yaml", "utf-8"),
    { schema: schema },
  );
  template = Template.fromJSON(yamltemplate);
});

it("Should not use DefinitionBody as part of the serverless::api", () => {
  // N.B this only passes as we currently delete it on line 14 in the test setup step.
  template.hasResource("AWS::Serverless::Api", {
    DefinitionBody: Match.absent(),
  });
});

it("The template contains two API gateway resource", () => {
  template.resourceCountIs("AWS::Serverless::Api", 4);
});

it("Has tracing enabled on at least one API", () => {
  template.hasResourceProperties("AWS::Serverless::Api", {
    TracingEnabled: true,
  });
});

it("There are 1 lambdas defined, all with a specific permission:", () => {
  const lambda_count = 1;
  template.resourceCountIs("AWS::Serverless::Function", lambda_count);
  template.resourceCountIs("AWS::Lambda::Permission", lambda_count);
});

it("All lambdas must have a FunctionName defined", () => {
  const lambdas = template.findResources("AWS::Serverless::Function");
  const lambda_list = Object.keys(lambdas);
  lambda_list.forEach((lambda) => {
    expect(lambdas[lambda].Properties.FunctionName).toBeTruthy();
  });
});

it("All Lambdas must have an associated LogGroup named after their FunctionName.", () => {
  const lambdas = template.findResources("AWS::Serverless::Function");
  const lambda_list = Object.keys(lambdas);
  lambda_list.forEach((lambda) => {
    // These are functions we know are broken, but have to skip for now.
    // They should be resolved and removed from this list ASAP.
    const functionName = lambdas[lambda].Properties.FunctionName["Fn::Sub"];
    console.log(functionName);
    const expectedLogName = {
      "Fn::Sub": `/aws/lambda/${functionName}`,
    };
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: Match.objectLike(expectedLogName),
    });
  });
});

it("Each log group defined must have a retention period", () => {
  const logGroups = template.findResources("AWS::Logs::LogGroup");
  const logGroupList = Object.keys(logGroups);
  logGroupList.forEach((logGroup) => {
    expect(logGroups[logGroup].Properties.RetentionInDays).toBeTruthy();
  });
});

describe("Log group retention", () => {
  test.each`
    environment      | retention
    ${"dev"}         | ${3}
    ${"build"}       | ${3}
    ${"staging"}     | ${3}
    ${"integration"} | ${30}
    ${"production"}  | ${30}
  `(
    "Log group retention period for $environment has correct value in mappings",
    ({ environment, retention }) => {
      const mappings = template.findMappings("EnvironmentConfiguration");
      expect(
        mappings.EnvironmentConfiguration[environment].logretentionindays,
      ).toBe(retention);
    },
  );
});
