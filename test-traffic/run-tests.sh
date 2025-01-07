#!/usr/bin/env bash

set -eu

remove_quotes () {
  echo "$1" | tr -d '"'
}

declare error_code
# shellcheck disable=SC2154
#The CFN variables seem to include quotes when used in tests these must be removed before assigning them.
CFN_CICBackendURL_NoQuotes=$(remove_quotes "$CFN_CICBackendURL")
export DEV_CRI_CIC_API_URL=$(echo ${CFN_CICBackendURL_NoQuotes%/})
export DEV_IPV_STUB_URL=$(remove_quotes $CFN_CICIPVStubExecuteURL)/start
export DEV_CIC_TEST_HARNESS_URL=$(remove_quotes "$CFN_CICTestHarnessURL")
export VC_SIGNING_KEY_ID=$(remove_quotes "$CFN_VcSigningKeyId")
export DNS_SUFFIX=$(remove_quotes "$CFN_DNSSuffix")
export DEV_CIC_SESSION_TABLE_NAME=$(remove_quotes "$CFN_SessionTableName")

echo "Traffic tests (CIC-CRI)"
# disabling error_check to allow report generation for successful + failed tests
set +e
apt-get install jq -y

cd /src;

echo "Waiting for 5 minutes before starting traffic tests (CIC-CRI)"
sleep 300

echo "Running Traffic tests (CIC-CRI)"
for i in {1..10}
do
  echo "CIC-CRI-Test# $i"
  npm run test:api
done

error_code=$?
if [ $error_code -ne 0 ]
then
  exit $error_code
fi
