#!/usr/bin/env bash

set -eu

declare error_code
# shellcheck disable=SC2154
export DEV_CRI_CIC_API_URL=`echo ${CFN_CICBackendURL%/}`
export DEV_IPV_STUB_URL="https://erveje5km8.execute-api.eu-west-2.amazonaws.com/dev/start"
env

./src/node_modules/.bin/jest --config ./src/jest.config.ts --test-match '**/tests/api/e2e*.test.ts'

error_code=$?

exit $error_code

# if [[ $status_code != "200" ]]; then
#   cat <<EOF > "$TEST_REPORT_ABSOLUTE_DIR/result.json"
# [
#   {
#     "uri": "test.sh",
#     "name": "Acceptance test",
#     "elements": [
#       {
#         "type": "scenario",
#         "name": "API Gateway request",
#         "line": 6,
#         "steps": [
#           {
#             "keyword": "Given ",
#             "name": "this step fails",
#             "line": 6,
#             "match": {
#               "location": "test.sh:4"
#             },
#             "result": {
#               "status": "failed",
#               "error_message": " Lambda did not return HTTP status code 200",
#               "duration": 1
#             }
#           }
#         ]
#       }
#     ]
#   }
# ]
# EOF
# exit 1
# else
#   cat <<EOF > "$TEST_REPORT_ABSOLUTE_DIR/result.json"
# [
#   {
#     "uri": "test.sh",
#     "name": "Acceptance test",
#     "elements": [
#       {
#         "type": "scenario",
#         "name": "API Gateway request",
#         "line": 6,
#         "steps": [
#           {
#             "keyword": "Given ",
#             "name": "this step fails",
#             "line": 6,
#             "match": {
#               "location": "test.sh:4"
#             },
#             "result": {
#               "status": "passed",
#               "duration": 1
#             }
#           }
#         ]
#       }
#     ]
#   }
# ]
# EOF
# fi
