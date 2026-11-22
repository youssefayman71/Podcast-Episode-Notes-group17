#!/usr/bin/env bash
# AWS CLI + Floci profile must already be configured (see Lab 7).
set -euo pipefail
PROFILE=${AWS_PROFILE:-floci}
PREFIX=${TABLE_PREFIX:-podcast}
for table in users episodes notes library tags noteTags; do
  aws --profile "$PROFILE" --endpoint-url http://localhost:4566 dynamodb create-table \
    --table-name "$PREFIX-$table" --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST
done
echo 'Created six DynamoDB tables. Next: IAM role, Lambda, API Gateway and S3 (see deployment guide).'
