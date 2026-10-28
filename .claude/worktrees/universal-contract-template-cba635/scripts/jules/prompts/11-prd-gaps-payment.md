# BrandWars.kz — post-MVP: PRD gaps + payment path

You are working on the private repo `Allexndr/brand_wars` (branch `main`).
Production: https://brand-wars.vercel.app
Stack: Next.js 15, Prisma, Neon Postgres, NextAuth v5, next-intl (ru/kk), Tailwind, PixiJS.

## Context
MVP sessions 1–10 are already on main. Light design system is live (globals.css imported, Manrope/Literata, warm orange primary, 3-step ClaimWizard). Do NOT revert to dark slate/sky theme. Do NOT introduce purple gradients or Inter-only typography.

## Goal
Close critical MVP gaps so a brand owner can go from homepage → claim → pay (test mode) → moderation queue with minimal friction (TTV < 60s).

## Must do
1. Read `docs/brandwars-kz-master-prd-and-spec.md` and list gaps vs current code. Fix only high-priority missing acceptance criteria for claim → pay → moderation.
2. Harden claim → payment flow:
   - Keep 3 steps: link → details (category + bid) → pay
   - Guest can fill steps 1–2; login required only at pay (already intended)
   - Ensure `/api/payments/confirm-test` works when `PAYMENT_TEST_MODE=true`
   - After successful test pay, claim must appear in admin moderation queue
   - Clear success UI with map CTA
3. Preserve legal copy: «лидер BrandWars в категории», never «лучший бренд».
4. Keep ru + kk i18n in sync for any new strings.
5. Do not break smoke tests in `tests/smoke.spec.ts`; update them if copy/selectors changed.
6. Prefer small, focused PR. No drive-by refactors. No committing secrets/.env.

## Out of scope
- Real Kaspi/Stripe production keys
- Full PixiJS planet rewrite
- Jules/deploy scripts changes

## Deliverable
Open a PR with title like `fix: close claim-pay-moderation MVP gaps`.
Include a short PR description: what was broken, what you fixed, how to verify locally.
