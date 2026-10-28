#!/usr/bin/env bash
# Run all 10 Jules sessions sequentially (merge each PR before next).
set -euo pipefail

cd "$(dirname "$0")/../.."
PROMPTS_DIR="scripts/jules/prompts"

SESSIONS=(
  "01-scaffold|feat: project scaffold and database schema"
  "02-auth|feat: authentication and role-based access"
  "03-brand-claims|feat: brand catalog and quick claim flow"
  "04-admin|feat: admin moderation panel"
  "05-territory|feat: battle power territory calculation engine"
  "06-payments|feat: payment integration with webhooks"
  "07-map|feat: pixijs 2D category map"
  "08-wallet|feat: user wallet and community support"
  "09-seo|feat: homepage i18n and SEO"
  "10-polish|feat: share cards events and final polish"
)

for entry in "${SESSIONS[@]}"; do
  IFS='|' read -r file title <<< "$entry"
  echo "=== Starting: $title ==="
  ./scripts/jules/run-session.sh --file "$PROMPTS_DIR/$file.md" "$title"
  SESSION_ID=$(cat .jules/latest-session)
  echo "Waiting for PR from session $SESSION_ID..."
  ./scripts/jules/poll-session.sh "$SESSION_ID"
  echo "Merge PR before continuing: $(cat .jules/latest-pr)"
  read -rp "Press Enter after merging PR to main..."
done

echo "All Jules sessions complete."
