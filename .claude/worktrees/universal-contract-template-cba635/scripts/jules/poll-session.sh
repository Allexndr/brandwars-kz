#!/usr/bin/env bash
set -euo pipefail

# Usage: ./poll-session.sh SESSION_ID [interval_seconds] [max_attempts]
#
# Polls Jules session until a pull request URL appears or timeout.

SESSION_ID="${1:-}"
INTERVAL="${2:-30}"
MAX_ATTEMPTS="${3:-120}"

if [[ -z "$SESSION_ID" ]]; then
  if [[ -f .jules/latest-session ]]; then
    SESSION_ID=$(cat .jules/latest-session)
  else
    echo "Usage: $0 SESSION_ID [interval] [max_attempts]" >&2
    exit 1
  fi
fi

if [[ -z "${JULES_API_KEY:-}" ]]; then
  echo "Error: JULES_API_KEY is not set" >&2
  exit 1
fi

echo "Polling session $SESSION_ID (every ${INTERVAL}s, max ${MAX_ATTEMPTS} attempts)..."

for ((i=1; i<=MAX_ATTEMPTS; i++)); do
  SESSION=$(curl -sS "https://jules.googleapis.com/v1alpha/sessions/$SESSION_ID" \
    -H "x-goog-api-key: $JULES_API_KEY")

  PR_URL=$(echo "$SESSION" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    for out in d.get('outputs', []) or []:
        pr = out.get('pullRequest') or {}
        if pr.get('url'):
            print(pr['url'])
            sys.exit(0)
except Exception:
    pass
" 2>/dev/null || true)

  if [[ -n "$PR_URL" ]]; then
    echo ""
    echo "Pull request ready: $PR_URL"
    echo "$PR_URL" > ".jules/latest-pr"
    echo "$SESSION" | python3 -m json.tool 2>/dev/null || echo "$SESSION"
    exit 0
  fi

  STATE=$(echo "$SESSION" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state','unknown'))" 2>/dev/null || echo "unknown")
  echo "[$(date +%H:%M:%S)] attempt $i/$MAX_ATTEMPTS — state: $STATE"

  if [[ "$STATE" == "FAILED" || "$STATE" == "CANCELLED" ]]; then
    echo "Session ended with state: $STATE"
    echo "$SESSION" | python3 -m json.tool 2>/dev/null || echo "$SESSION"
    exit 1
  fi

  sleep "$INTERVAL"
done

echo "Timeout waiting for PR. Last session state:"
curl -sS "https://jules.googleapis.com/v1alpha/sessions/$SESSION_ID/activities?pageSize=10" \
  -H "x-goog-api-key: $JULES_API_KEY" | python3 -m json.tool 2>/dev/null || true
exit 1
