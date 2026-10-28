Build BrandWars.kz MVP scaffold. Read docs/brandwars-kz-master-prd-and-spec.md sections 16-17.

Requirements:
- create-next-app with Next.js 15, TypeScript, App Router, Tailwind CSS, ESLint, pnpm
- Prisma ORM with PostgreSQL — full schema from PRD §17: users, user_profiles, organizations, organization_members, brands, brand_aliases, brand_links, brand_assets, brand_verifications, brand_claims, brand_disputes, categories, seasons, season_categories, territories, territory_snapshots, leaderboard_snapshots, campaigns, transactions, payment_orders, wallets, wallet_transactions, community_support_actions, events, moderation_cases, moderation_actions, reports, audit_logs, notifications, share_cards
- docker-compose.yml already exists — wire DATABASE_URL
- Seed script: 6 MVP categories (travel/Travelia 2000₸, beauty/Beauty Republic 2000₸, code/Codeverse 1500₸, ai-agents/Agentoria 1500₸, games/Game Islands 1500₸, marketing/Marketland 2000₸) with price coefficients from PRD, 1 active 30-day season
- GET /api/health returns { status: "ok", db: "connected" }
- .env.example already exists — extend if needed
- README with pnpm dev instructions
- Do NOT add Three.js or 3D

Acceptance: pnpm install && pnpm prisma migrate dev && pnpm prisma db seed && pnpm build succeed.
