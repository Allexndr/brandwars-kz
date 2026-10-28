Share cards, events, and final polish. Read docs/brandwars-kz-master-prd-and-spec.md sections 9, 14.10, 21, 24.

Requirements:
- Share card API GET /api/share-cards/:brandSlug — generates 1080x1920 (stories) and 1200x630 (social) via @vercel/og or canvas
- Events: "Штурм столицы" (capital siege timer when #2 within 5% of #1) and "Парад категории" (top 3 celebration) — simplified server logic + UI badges
- /hall-of-fame/[season] — archive of season winners
- /report — complaint form (fake brand, wrong logo, trademark, offensive content, fraud) → POST /api/reports
- PostHog + Sentry integration (env-gated, no-op if keys missing)
- Playwright e2e smoke test: claim → admin approve → test pay → map shows brand
- vercel.json for deployment

Acceptance: full smoke test passes; share card URL returns PNG.
