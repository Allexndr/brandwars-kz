import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Creates brand-earnings tables if missing (Neon without migrate on deploy).
 * Auth: Bearer FOUNDERS_SEED_SECRET (same ops secret).
 */
export async function POST(request: NextRequest) {
  const expected = process.env.FOUNDERS_SEED_SECRET?.trim();
  const received = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!expected || !received || expected !== received) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statements = [
    `DO $$ BEGIN
      CREATE TYPE "BrandEarningsEntryType" AS ENUM (
        'SUPPORT_CREDIT', 'WITHDRAWAL_HOLD', 'WITHDRAWAL_PAID', 'WITHDRAWAL_RELEASE', 'ADJUSTMENT'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "WithdrawalStatus" AS ENUM (
        'PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `CREATE TABLE IF NOT EXISTS "brand_earnings_wallets" (
      "id" TEXT PRIMARY KEY,
      "brand_id" TEXT NOT NULL UNIQUE,
      "available_kzt" INTEGER NOT NULL DEFAULT 0,
      "reserved_kzt" INTEGER NOT NULL DEFAULT 0,
      "lifetime_earned_kzt" INTEGER NOT NULL DEFAULT 0,
      "lifetime_withdrawn_kzt" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "brand_earnings_wallets_brand_id_fkey"
        FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS "brand_earnings_entries" (
      "id" TEXT PRIMARY KEY,
      "brand_id" TEXT NOT NULL,
      "type" "BrandEarningsEntryType" NOT NULL,
      "amount_kzt" INTEGER NOT NULL,
      "gross_kzt" INTEGER,
      "platform_fee_kzt" INTEGER,
      "payment_order_id" TEXT,
      "transaction_id" TEXT,
      "withdrawal_id" TEXT,
      "note" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "brand_earnings_entries_brand_id_fkey"
        FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "brand_earnings_entries_brand_id_created_at_idx"
      ON "brand_earnings_entries"("brand_id", "created_at");`,
    `CREATE INDEX IF NOT EXISTS "brand_earnings_entries_payment_order_id_idx"
      ON "brand_earnings_entries"("payment_order_id");`,
    `CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
      "id" TEXT PRIMARY KEY,
      "brand_id" TEXT NOT NULL,
      "requested_by_id" TEXT NOT NULL,
      "amount_kzt" INTEGER NOT NULL,
      "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
      "payout_details" TEXT NOT NULL,
      "reviewed_by_id" TEXT,
      "reviewed_at" TIMESTAMP(3),
      "paid_at" TIMESTAMP(3),
      "admin_note" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "withdrawal_requests_brand_id_fkey"
        FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "withdrawal_requests_requested_by_id_fkey"
        FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "withdrawal_requests_reviewed_by_id_fkey"
        FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "withdrawal_requests_status_created_at_idx"
      ON "withdrawal_requests"("status", "created_at");`,
    `CREATE INDEX IF NOT EXISTS "withdrawal_requests_brand_id_created_at_idx"
      ON "withdrawal_requests"("brand_id", "created_at");`,
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  return NextResponse.json({ ok: true });
}
