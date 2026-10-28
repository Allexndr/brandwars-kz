import "server-only";

import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import type { CheckoutProvider } from "@/lib/payments/methods";
import { recalculateCategory } from "@/lib/territory";
import { claimCell, expandFrontierIfNeeded, payUpkeep } from "@/lib/arena";
import {
  addContestBid,
  notifyDefenderOfContest,
  openContest,
} from "@/lib/contest";
import { Prisma, type TransactionType } from "@prisma/client";

type DbClient = typeof prisma | Prisma.TransactionClient;

class LandIntentError extends Error {}

/**
 * Everything that turns money into land goes through here, so the rule from the
 * product spec holds in exactly one place: a brand never gains ground before
 * the payment behind it is confirmed.
 *
 * Two routes in:
 *   - wallet balance covers it  -> debit and apply immediately;
 *   - otherwise                 -> a PaymentOrder carrying the intent, applied
 *                                  by the webhook once the provider confirms.
 */

export type LandIntent =
  | { kind: "cell_claim"; arenaId: string; q: number; r: number; brandId: string }
  | { kind: "cell_upkeep"; cellId: string; brandId: string }
  | { kind: "contest_open"; cellId: string; brandId: string; primeTime?: boolean }
  | { kind: "contest_bid"; contestId: string; brandId: string };

const INTENT_TRANSACTION_TYPE: Record<LandIntent["kind"], TransactionType> = {
  cell_claim: "CELL_CLAIM",
  cell_upkeep: "CELL_UPKEEP",
  contest_open: "CONTEST_BID",
  contest_bid: "CONTEST_BID",
};

export type ApplyResult =
  | { ok: true; detail?: Record<string, unknown> }
  | { ok: false; reason: string };

/** Run the effect of an intent whose money is now confirmed. */
export async function applyLandIntent(
  intent: LandIntent,
  context: { userId: string; amountKzt: number },
  db: DbClient = prisma,
): Promise<ApplyResult> {
  switch (intent.kind) {
    case "cell_claim": {
      const result = await claimCell(
        {
          arenaId: intent.arenaId,
          q: intent.q,
          r: intent.r,
          brandId: intent.brandId,
          userId: context.userId,
          amountKzt: context.amountKzt,
        },
        db,
      );
      if (!result.ok) return { ok: false, reason: result.reason };
      if (db === prisma) {
        void expandFrontierIfNeeded(intent.arenaId).catch((error) =>
          console.error("[frontier-expand]", error),
        );
      }
      return { ok: true, detail: { cellId: result.cellId } };
    }

    case "cell_upkeep": {
      const done = await payUpkeep(
        {
          cellId: intent.cellId,
          brandId: intent.brandId,
          amountKzt: context.amountKzt,
        },
        db,
      );
      return done ? { ok: true } : { ok: false, reason: "upkeep_failed" };
    }

    case "contest_open": {
      const result = await openContest(
        {
          cellId: intent.cellId,
          challengerBrandId: intent.brandId,
          userId: context.userId,
          amountKzt: context.amountKzt,
          primeTime: intent.primeTime,
        },
        db,
      );
      if (!result.ok) return { ok: false, reason: result.reason };
      return {
        ok: true,
        detail: { contestId: result.contestId, closesAt: result.closesAt },
      };
    }

    case "contest_bid": {
      const result = await addContestBid(
        {
          contestId: intent.contestId,
          brandId: intent.brandId,
          userId: context.userId,
          amountKzt: context.amountKzt,
        },
        db,
      );
      if (!result.ok) return { ok: false, reason: result.reason };
      return {
        ok: true,
        detail: {
          challengerKzt: result.challengerKzt,
          defenderKzt: result.defenderKzt,
        },
      };
    }
  }
}

export type PurchaseOutcome =
  | { status: "applied"; detail?: Record<string, unknown> }
  | {
      status: "payment_required";
      paymentUrl?: string;
      orderId: string;
      mode?: "redirect" | "kaspi_invoice";
      message?: string;
    }
  | { status: "error"; reason: string };

/**
 * Charge for an intent. Wallet first (that is where refunded contest stakes
 * live, so losing a siege leaves you with something to spend), card otherwise.
 */
export async function purchaseLand(params: {
  intent: LandIntent;
  userId: string;
  amountKzt: number;
  seasonCategoryId?: string;
  paymentProvider?: CheckoutProvider;
  phone?: string;
}): Promise<PurchaseOutcome> {
  const { intent, userId, amountKzt } = params;

  if (amountKzt <= 0) return { status: "error", reason: "invalid_amount" };

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { id: true, balance: true },
  });

  if (wallet && wallet.balance >= amountKzt) {
    let applied: ApplyResult | null = null;
    try {
      applied = await prisma.$transaction(async (tx) => {
        const debited = await tx.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: amountKzt } },
          data: { balance: { decrement: amountKzt } },
        });
        if (debited.count === 0) return null;

        const result = await applyLandIntent(intent, { userId, amountKzt }, tx);
        if (!result.ok) throw new LandIntentError(result.reason);

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "DEBIT",
            amount: amountKzt,
            description: landIntentDescription(intent),
          },
        });
        await tx.transaction.create({
          data: {
            userId,
            brandId: intent.brandId,
            seasonCategoryId: params.seasonCategoryId,
            type: INTENT_TRANSACTION_TYPE[intent.kind],
            amountKzt,
            status: "COMPLETED",
            paymentProvider: "wallet",
          },
        });

        return result;
      });
    } catch (error) {
      if (error instanceof LandIntentError) {
        return { status: "error", reason: error.message };
      }
      throw error;
    }

    // A concurrent purchase may have consumed the balance after our initial
    // read. In that case fall through to hosted card payment.
    if (applied?.ok) {
      if (intent.kind === "cell_claim") {
        void expandFrontierIfNeeded(intent.arenaId).catch((error) =>
          console.error("[frontier-expand]", error),
        );
      }
      if (intent.kind === "contest_open" && applied.detail?.contestId) {
        void notifyDefenderOfContest(String(applied.detail.contestId)).catch((error) =>
          console.error("[contest-notify]", error),
        );
      }

      if (params.seasonCategoryId) {
        await recalculateCategory(params.seasonCategoryId);
      }

      return { status: "applied", detail: applied.detail };
    }
  }

  const provider =
    process.env.PAYMENT_TEST_MODE === "true"
      ? getPaymentProvider("test")
      : getPaymentProvider(params.paymentProvider);
  const idempotencyKey = `land_${intent.kind}_${intent.brandId}_${amountKzt}_${Date.now()}`;

  const order = await provider.createOrder({
    amountKzt,
    userId,
    brandId: intent.brandId,
    idempotencyKey,
    metadata: { reason: intent.kind },
    phone: params.phone,
    description: landIntentDescription(intent),
  });

  const created = await prisma.paymentOrder.create({
    data: {
      userId,
      brandId: intent.brandId,
      amountKzt,
      status: "PENDING",
      paymentProvider: provider.name,
      providerOrderId: order.providerOrderId,
      checkoutUrl: order.paymentUrl,
      idempotencyKey,
      metadata: {
        landIntent: intent,
        seasonCategoryId: params.seasonCategoryId ?? null,
      } as unknown as Prisma.InputJsonObject,
    },
    select: { id: true },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "";

  return {
    status: "payment_required",
    orderId: created.id,
    paymentUrl:
      order.paymentUrl ??
      (order.mode === "kaspi_invoice"
        ? undefined
        : `${appUrl}/ru/dashboard?order=${created.id}`),
    mode: order.mode,
    message: order.message,
  };
}

/**
 * Called by the payment webhook once an order is confirmed. Returns true when
 * the order carried a land intent and it was applied.
 */
export async function applyPaidLandOrder(orderId: string): Promise<boolean> {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      amountKzt: true,
      metadata: true,
      paymentProvider: true,
      providerOrderId: true,
      appliedAt: true,
    },
  });

  if (!order) return false;
  if (order.appliedAt) return true;

  const metadata = (order.metadata ?? {}) as {
    landIntent?: LandIntent;
    seasonCategoryId?: string | null;
  };
  const intent = metadata.landIntent;
  if (!intent) return false;

  const result = await prisma.$transaction(async (tx) => {
    // This conditional update is both the idempotency claim and the row lock.
    // If the transaction rolls back, the claim rolls back with the land action.
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: order.id, appliedAt: null },
      data: { appliedAt: new Date() },
    });
    if (claimed.count === 0) return { alreadyApplied: true, applied: true };

    const applied = await applyLandIntent(
      intent,
      { userId: order.userId, amountKzt: order.amountKzt },
      tx,
    );

    if (!applied.ok) {
      // The payment succeeded but the target changed meanwhile. Keep the money
      // as explicit wallet credit, not silent platform revenue.
      const wallet = await tx.wallet.upsert({
        where: { userId: order.userId },
        update: { balance: { increment: order.amountKzt } },
        create: { userId: order.userId, balance: order.amountKzt },
        select: { id: true },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          amount: order.amountKzt,
          description: `Действие уже недоступно — сумма зачислена на баланс (${applied.reason})`,
        },
      });
      await tx.transaction.create({
        data: {
          paymentOrderId: order.id,
          userId: order.userId,
          brandId: intent.brandId,
          seasonCategoryId: metadata.seasonCategoryId ?? undefined,
          type: "REFUND",
          amountKzt: order.amountKzt,
          status: "REFUNDED",
          paymentProvider: order.paymentProvider,
          providerPaymentId: order.providerOrderId ?? undefined,
        },
      });
      return { alreadyApplied: false, applied: false, reason: applied.reason };
    }

    await tx.transaction.create({
      data: {
        paymentOrderId: order.id,
        userId: order.userId,
        brandId: intent.brandId,
        seasonCategoryId: metadata.seasonCategoryId ?? undefined,
        type: INTENT_TRANSACTION_TYPE[intent.kind],
        amountKzt: order.amountKzt,
        status: "COMPLETED",
        paymentProvider: order.paymentProvider,
        providerPaymentId: order.providerOrderId ?? undefined,
      },
    });

    return { alreadyApplied: false, applied: true, detail: applied.detail };
  });

  if (!result.alreadyApplied && result.applied) {
    if (intent.kind === "cell_claim") {
      void expandFrontierIfNeeded(intent.arenaId).catch((error) =>
        console.error("[frontier-expand]", error),
      );
    }
    if (intent.kind === "contest_open" && result.detail?.contestId) {
      void notifyDefenderOfContest(String(result.detail.contestId)).catch((error) =>
        console.error("[contest-notify]", error),
      );
    }
    if (metadata.seasonCategoryId) {
      await recalculateCategory(metadata.seasonCategoryId);
    }
  }

  return result.applied;
}

function landIntentDescription(intent: LandIntent): string {
  switch (intent.kind) {
    case "cell_claim":
      return `Покупка клетки (${intent.q}, ${intent.r})`;
    case "cell_upkeep":
      return "Поддержка клетки";
    case "contest_open":
      return "Открытие окна противостояния";
    case "contest_bid":
      return "Усиление в окне противостояния";
  }
}
