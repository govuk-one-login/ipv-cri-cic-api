#!/usr/bin/env bash

LOG_GROUP="/aws/lambda/CIC-Session-cic-cri-api"
QUERY='fields @timestamp, @message, @logStream, @log | filter @message like "Received session request" | limit 20'

current_epoch=$(date +%s)
one_hour_ago_epoch=$((current_epoch - (60 * 60)))

START_TIME=$one_hour_ago_epoch
END_TIME=$current_epoch

QUERY_ID=$(aws logs start-query \
    --log-group-name "$LOG_GROUP" \
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