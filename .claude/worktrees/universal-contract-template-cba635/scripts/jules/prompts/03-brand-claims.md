Implement brand catalog and quick claim flow. Read docs/brandwars-kz-master-prd-and-spec.md sections 10, 14.4-14.7.

Pages:
- /brands — search, filters (category, verification status), brand cards
- /claim-brand — 5-step wizard: (1) paste URL (2) auto-fetch OG metadata/title/favicon (3) name+category+email (4) bid amount (5) summary → creates BrandClaim pending moderation
- /brand/[slug] — public brand page: logo, verification badge, category, territory placeholder, external link CTA, support button stub, "Реклама" label where applicable
- /verify — UI for verification methods: corporate email, DNS TXT, meta-tag, html file (backend stubs OK)

APIs:
- GET /api/brands, GET /api/brands/:slug
- POST /api/brand-claims
- POST /api/brands/metadata-fetch — accepts URL, returns title, description, og:image, favicon

Legal copy: use "лидер BrandWars в категории", NEVER "лучший бренд Казахстана".

Acceptance: claim created in under 60 seconds; OG preview works for valid URLs.
