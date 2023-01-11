#!/usr/bin/env bash
set -e

stack_name="$1"

if [ -z "$stack_name" ]
then
echo "😱 stack name expected as first argument, e.g. ./deploy di-ipv-cri-cic"
exit 1
fi

sam validate -t infrastructure/lambda/template.yaml
sam build -t infrastructure/lambda/template.yaml
sam deploy --stack-name "$stack_name" \
   --no-fail-on-empty-changeset \
   --no-confirm-changeset \
   --resolve-s3 \
   --region eu-west-2 \
   --capabilities CAPABILITY_IAM \
   --parameter-overrides \
   CodeSigningEnabled=false \
   Environment=dev \
   AuditEventNamePrefix=/common-cri-parameters/AuditEventNamePrefix \
   CriIdentifier=/common-cri-parameters/CriIdentifier \
   CommonStackName=common-cri-api \
   SecretPrefix=cic-cri-api
