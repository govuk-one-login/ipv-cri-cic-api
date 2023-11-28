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

cd /src; npm run test:api
error_code=$?

cp -rf results $TEST_REPORT_ABSOLUTE_DIR

exit $error_code
