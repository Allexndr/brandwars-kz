# Deployment Guide — BrandWars.kz

## Vercel (recommended)

1. Import [Allexndr/brand_wars](https://github.com/Allexndr/brand_wars) on [vercel.com/new](https://vercel.com/new)
2. Set **Framework**: Next.js, **Root**: `.`, **Build**: `prisma generate && next build`
3. Add environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon/Supabase PostgreSQL connection string |
| `NEXTAUTH_URL` | `https://brandwars.kz` or Vercel preview URL |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `PAYMENT_TEST_MODE` | `true` for beta |
| `UPSTASH_REDIS_REST_URL` | Optional leaderboard cache |
| `UPSTASH_REDIS_REST_TOKEN` | Optional |

4. Deploy — region `fra1` (configured in `vercel.json`, close to KZ)

## Database setup

```bash
# After first deploy, run migrations against production DB:
DATABASE_URL="postgresql://..." pnpm prisma db push
DATABASE_URL="postgresql://..." pnpm db:seed
```

Recommended providers:
- [Neon](https://neon.tech) — serverless PostgreSQL
- [Supabase](https://supabase.com)

## Local development

```bash
cp .env.example .env
docker-compose up -d   # PostgreSQL + Redis
pnpm db:push
pnpm db:seed
pnpm dev
# → http://localhost:3000/ru
```

## Smoke tests (PRD §24)

```bash
pnpm dev &
pnpm exec playwright install chromium
pnpm test:e2e
```

Checklist:
- [ ] Claim flow completes in < 60 sec
- [ ] Moderation queue approve/reject works
- [ ] Test payment → territory recalculates
- [ ] `/ru/map` and `/ru/category/travel` render
- [ ] Share card: `/api/share-cards/{slug}`
- [ ] ru + kk locales load

## Jules CI (optional)

After connecting Jules GitHub App to `Allexndr/brand_wars`:

```bash
export JULES_API_KEY=your_key
./scripts/jules/list-sources.sh
./scripts/jules/run-all-sessions.sh
```

MVP is already on `main`; use Jules for incremental features.
