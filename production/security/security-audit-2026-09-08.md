# Security Audit Report

**Date**: 2026-09-08  
**Scope**: full (monetized web app / BrandWars.kz)  
**Stack**: Next.js 15, Prisma, NextAuth, Unicorn/Prodamus/PayProverka  
**Audited by**: security-review + security-audit skill  

---

## Executive Summary

| Severity | Count | Must Fix Before Release |
|----------|------:|-------------------------|
| CRITICAL | 0* | *if `PAYMENT_TEST_MODE=true` in prod → treat as CRITICAL |
| HIGH | 3 | Yes — **remediated in this pass** |
| MEDIUM | 3 | Yes — **remediated in this pass** |
| LOW | few | Optional |

**Release recommendation**: FIX CRITICALS FIRST → after this pass + live payment keys + KZ data residency decision → soft launch OK; full public launch still blocked by ops/legal checklist (SELLER_*, PD localization, email).

---

## Remediated HIGH

### SEC-001: Owner self-support 80% cashback loop
**Status**: Fixed  
**Files**: `src/lib/payment-fulfillment.ts`, `src/app/api/dashboard/top-up/route.ts`  
Owner boosting own brand is always `TOP_UP`; `purpose=support` from owner is forced to `top_up`.

### SEC-002: Unicorn webhook trust
**Status**: Fixed (partial — secret still in notify URL for provider compat)  
**Files**: `src/lib/payments/unicorn.ts`, `src/app/api/webhooks/unicorn/route.ts`  
- Amount required for fulfillment  
- Paid heuristics tightened (no bare `status:paid` / lone ACTION=0)

### SEC-003: Test mode free fulfillment
**Status**: Fixed  
**Files**: `src/app/api/payments/confirm-test/route.ts`, `.env.example`  
Blocked when `NODE_ENV=production` or `VERCEL_ENV=production`; example defaults to `false`.

---

## Remediated MEDIUM

### SEC-004: Unauthenticated kaspi-status
**Status**: Fixed  
**Files**: `src/app/api/payments/kaspi-status/route.ts`, `src/lib/payments/status-token.ts`  
Requires session owner **or** HMAC `token` issued at checkout.

### SEC-005: SSRF via metadata-fetch
**Status**: Fixed  
**Files**: `src/lib/metadata-fetch.ts`  
DNS private-IP block + no redirect follow (same pattern as image-proxy).

### SEC-006: Unicorn secret in notify URL
**Status**: Accepted risk (documented)  
Unicorn notify API expects query secret; amount match mitigates stolen-secret fulfillment. Prefer header/HMAC when provider supports it.

---

## Remaining blockers (ops / legal, not code)

1. Personal data localization (DB in KZ) — `fra1` today  
2. `SELLER_*` invoice fields  
3. Live `PAYPROVERKA_*` / Unicorn certs on BrandWars  
4. Email SMTP for magic link  
5. Confirm `PAYMENT_TEST_MODE=false` on Vercel Production  

---

## Remediation Priority (done)

1. SEC-001 support loop — done  
2. SEC-002 Unicorn amount — done  
3. SEC-003 test mode — done  
4. SEC-004 kaspi-status auth — done  
5. SEC-005 SSRF — done  

Re-audit trigger: after next payment-provider change or before public launch.
