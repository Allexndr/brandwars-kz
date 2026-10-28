import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Platform keeps 20%; brand earns 80% of fan support. */
export const SUPPORT_PLATFORM_FEE_BPS = 2_000;
export const SUPPORT_BRAND_SHARE_BPS = 8_000;
export const WITHDRAW_MIN_KZT = 10_000;

export function splitSupportAmount(grossKzt: number): {
  platformFeeKzt: number;
  brandShareKzt: number;
} {
  const platformFeeKzt = Math.floor((grossKzt * SUPPORT_PLATFORM_FEE_BPS) / 10_000);
  return {
    platformFeeKzt,
    brandShareKzt: grossKzt - platformFeeKzt,
  };
}

type Tx = Prisma.TransactionClient;

async function ensureWallet(tx: Tx, brandId: string) {
  return tx.brandEarningsWallet.upsert({
    where: { brandId },
    update: {},
    create: { brandId },
  });
}

/**
 * Credit the brand share of a paid support donation.
 * Idempotent on paymentOrderId — a second call is a no-op.
 */
export async function creditSupportEarnings(params: {
  brandId: string;
  grossKzt: number;
  paymentOrderId: string;
  transactionId: string;
  db?: Tx;
}): Promise<{ brandShareKzt: number; platformFeeKzt: number; alreadyCredited: boolean }> {
  const run = async (tx: Tx) => {
    const existing = await tx.brandEarningsEntry.findFirst({
      where: {
        paymentOrderId: params.paymentOrderId,
        type: "SUPPORT_CREDIT",
      },
      select: { id: true, amountKzt: true, platformFeeKzt: true },
    });
    if (existing) {
      return {
        brandShareKzt: existing.amountKzt,
        platformFeeKzt: existing.platformFeeKzt ?? 0,
        alreadyCredited: true,
      };
    }

    const { platformFeeKzt, brandShareKzt } = splitSupportAmount(params.grossKzt);
    await ensureWallet(tx, params.brandId);

    await tx.brandEarningsEntry.create({
      data: {
        brandId: params.brandId,
        type: "SUPPORT_CREDIT",
        amountKzt: brandShareKzt,
        grossKzt: params.grossKzt,
        platformFeeKzt,
        paymentOrderId: params.paymentOrderId,
        transactionId: params.transactionId,
        note: `Поддержка · комиссия платформы ${platformFeeKzt} ₸`,
      },
    });

    await tx.brandEarningsWallet.update({
      where: { brandId: params.brandId },
      data: {
        availableKzt: { increment: brandShareKzt },
        lifetimeEarnedKzt: { increment: brandShareKzt },
      },
    });

    return { brandShareKzt, platformFeeKzt, alreadyCredited: false };
  };

  if (params.db) return run(params.db);
  return prisma.$transaction(run);
}

export async function requestWithdrawal(params: {
  brandId: string;
  userId: string;
  amountKzt: number;
  payoutDetails: string;
}) {
  if (params.amountKzt < WITHDRAW_MIN_KZT) {
    return { ok: false as const, error: `Минимум вывода — ${WITHDRAW_MIN_KZT.toLocaleString("ru-KZ")} ₸` };
  }

  const brand = await prisma.brand.findUnique({
    where: { id: params.brandId },
    select: {
      id: true,
      ownerUserId: true,
      verificationStatus: true,
      name: true,
    },
  });
  if (!brand || brand.ownerUserId !== params.userId) {
    return { ok: false as const, error: "Нет доступа к бренду" };
  }
  if (brand.verificationStatus !== "VERIFIED") {
    return {
      ok: false as const,
      error: "Вывод доступен после верификации бренда",
    };
  }

  try {
    const withdrawal = await prisma.$transaction(async (tx) => {
      await ensureWallet(tx, params.brandId);
      const wallet = await tx.brandEarningsWallet.findUniqueOrThrow({
        where: { brandId: params.brandId },
      });
      if (wallet.availableKzt < params.amountKzt) {
        throw new Error("Недостаточно средств на счёте");
      }

      const open = await tx.withdrawalRequest.findFirst({
        where: {
          brandId: params.brandId,
          status: { in: ["PENDING", "APPROVED"] },
        },
        select: { id: true },
      });
      if (open) {
        throw new Error("Уже есть открытая заявка на вывод");
      }

      const req = await tx.withdrawalRequest.create({
        data: {
          brandId: params.brandId,
          requestedById: params.userId,
          amountKzt: params.amountKzt,
          status: "PENDING",
          payoutDetails: params.payoutDetails.trim(),
        },
      });

      await tx.brandEarningsWallet.update({
        where: { brandId: params.brandId },
        data: {
          availableKzt: { decrement: params.amountKzt },
          reservedKzt: { increment: params.amountKzt },
        },
      });

      await tx.brandEarningsEntry.create({
        data: {
          brandId: params.brandId,
          type: "WITHDRAWAL_HOLD",
          amountKzt: -params.amountKzt,
          withdrawalId: req.id,
          note: "Резерв под вывод",
        },
      });

      return req;
    });

    return { ok: true as const, withdrawal };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Не удалось создать заявку",
    };
  }
}

export async function reviewWithdrawal(params: {
  withdrawalId: string;
  reviewerId: string;
  action: "approve" | "reject" | "paid";
  adminNote?: string;
}) {
  const existing = await prisma.withdrawalRequest.findUnique({
    where: { id: params.withdrawalId },
  });
  if (!existing) return { ok: false as const, error: "Заявка не найдена" };

  if (params.action === "approve") {
    if (existing.status !== "PENDING") {
      return { ok: false as const, error: "Можно одобрить только PENDING" };
    }
    await prisma.withdrawalRequest.update({
      where: { id: existing.id },
      data: {
        status: "APPROVED",
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        adminNote: params.adminNote,
      },
    });
    return { ok: true as const };
  }

  if (params.action === "reject") {
    if (!["PENDING", "APPROVED"].includes(existing.status)) {
      return { ok: false as const, error: "Нельзя отклонить в текущем статусе" };
    }
    await prisma.$transaction(async (tx) => {
      await tx.withdrawalRequest.update({
        where: { id: existing.id },
        data: {
          status: "REJECTED",
          reviewedById: params.reviewerId,
          reviewedAt: new Date(),
          adminNote: params.adminNote,
        },
      });
      await tx.brandEarningsWallet.update({
        where: { brandId: existing.brandId },
        data: {
          availableKzt: { increment: existing.amountKzt },
          reservedKzt: { decrement: existing.amountKzt },
        },
      });
      await tx.brandEarningsEntry.create({
        data: {
          brandId: existing.brandId,
          type: "WITHDRAWAL_RELEASE",
          amountKzt: existing.amountKzt,
          withdrawalId: existing.id,
          note: params.adminNote ?? "Вывод отклонён, средства возвращены",
        },
      });
    });
    return { ok: true as const };
  }

  // paid
  if (!["PENDING", "APPROVED"].includes(existing.status)) {
    return { ok: false as const, error: "Нельзя отметить оплаченным" };
  }
  await prisma.$transaction(async (tx) => {
    await tx.withdrawalRequest.update({
      where: { id: existing.id },
      data: {
        status: "PAID",
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        paidAt: new Date(),
        adminNote: params.adminNote,
      },
    });
    await tx.brandEarningsWallet.update({
      where: { brandId: existing.brandId },
      data: {
        reservedKzt: { decrement: existing.amountKzt },
        lifetimeWithdrawnKzt: { increment: existing.amountKzt },
      },
    });
    await tx.brandEarningsEntry.create({
      data: {
        brandId: existing.brandId,
        type: "WITHDRAWAL_PAID",
        amountKzt: -existing.amountKzt,
        withdrawalId: existing.id,
        note: params.adminNote ?? "Выплачено вручную",
      },
    });
  });
  return { ok: true as const };
}

export async function getBrandEarningsSummary(brandId: string) {
  const wallet = await prisma.brandEarningsWallet.findUnique({
    where: { brandId },
  });
  const entries = await prisma.brandEarningsEntry.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const withdrawals = await prisma.withdrawalRequest.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    availableKzt: wallet?.availableKzt ?? 0,
    reservedKzt: wallet?.reservedKzt ?? 0,
    lifetimeEarnedKzt: wallet?.lifetimeEarnedKzt ?? 0,
    lifetimeWithdrawnKzt: wallet?.lifetimeWithdrawnKzt ?? 0,
    platformFeeBps: SUPPORT_PLATFORM_FEE_BPS,
    brandShareBps: SUPPORT_BRAND_SHARE_BPS,
    withdrawMinKzt: WITHDRAW_MIN_KZT,
    entries,
    withdrawals,
  };
}
