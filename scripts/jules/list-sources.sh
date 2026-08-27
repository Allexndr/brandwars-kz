#!/usr/bin/env bash
set -euo pipefail

# List connected Jules sources
curl -sS "https://jules.googleapis.com/v1alpha/sources" \
  -H "x-goog-api-key: ${JULES_API_KEY:?JULES_API_KEY required}" \
  | python3 -m json.tool
