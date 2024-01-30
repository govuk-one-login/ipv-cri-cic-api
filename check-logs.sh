#!/usr/bin/env bash

LOG_GROUPS=(
    "/aws/lambda/CIC-Authorization-cic-cri-api"
    "/aws/lambda/CIC-ClaimedIdentity-cic-cri-api"
    "/aws/lambda/CIC-SessionConfig-cic-cri-api"
    "/aws/lambda/CIC-Session-cic-cri-api"
    "/aws/lambda/Access-Token-cic-cri-api"
    "/aws/lambda/User-Info-cic-cri-api"
)

# Import these values from happyPathSlim.json
QUERY='fields @timestamp, @message, @logStream, @log | filter @message like "Slim" or @message like "Test User" or @message like "1970"'

current_epoch=$(date +%s)
fifteen_mins_ago_epoch=$((current_epoch - (15 * 60)))

START_TIME=$fifteen_mins_ago_epoch
END_TIME=$current_epoch

QUERY_ID=$(aws logs start-query \
    --log-group-names "$LOG_GROUPS" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --query-string "$QUERY" \
    --output text --query 'queryId')

STATUS="Running"
while [ "$STATUS" = "Running" ]; do
    echo "Waiting for query to complete..."
    sleep 1
    QUERY_STATUS=$(aws logs get-query-results --query-id "$QUERY_ID")
    STATUS=$(echo "$QUERY_STATUS" | grep -o '"status": "[^"]*"' | cut -d '"' -f 4)
done

if echo "$QUERY_STATUS" | grep -q '"results": \[\]'; then
    echo "Query returned no results."
else
    echo "Query returned results:"
    echo "$QUERY_STATUS" | jq -r '.results[] | @json'
fi