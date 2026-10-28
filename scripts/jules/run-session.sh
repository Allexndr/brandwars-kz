#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./run-session.sh "prompt text" "Session Title"
#   ./run-session.sh --file scripts/jules/prompts/01-scaffold.md "feat: project scaffold"
#
# Requires: JULES_API_KEY, optional JULES_SOURCE (default: sources/github/Allexndr/brand_wars)

SOURCE="${JULES_SOURCE:-sources/github/Allexndr/brand_wars}"
BRANCH="${JULES_STARTING_BRANCH:-main}"

if [[ -z "${JULES_API_KEY:-}" ]]; then
  echo "Error: JULES_API_KEY is not set" >&2
  exit 1
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 [--file PATH] \"prompt\" \"title\"" >&2
  exit 1
fi

PROMPT=""
TITLE=""

if [[ "$1" == "--file" ]]; then
  PROMPT="$(cat "$2")"
  TITLE="$3"
else
  PROMPT="$1"
  TITLE="$2"
fi

# Escape prompt for JSON
PROMPT_JSON=$(python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<< "$PROMPT")

RESPONSE=$(curl -sS "https://jules.googleapis.com/v1alpha/sessions" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $JULES_API_KEY" \
  -d "{
    \"prompt\": $PROMPT_JSON,
    \"sourceContext\": {
      \"source\": \"$SOURCE\",
      \"githubRepoContext\": {
        \"startingBranch\": \"$BRANCH\"
      }
    },
    \"automationMode\": \"AUTO_CREATE_PR\",
    \"title\": \"$TITLE\"
  }")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

SESSION_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)

if [[ -n "$SESSION_ID" ]]; then
  echo ""
  echo "Session ID: $SESSION_ID"
  echo "Poll with: ./scripts/jules/poll-session.sh $SESSION_ID"
  mkdir -p .jules
  echo "$SESSION_ID" > ".jules/latest-session"
fi
