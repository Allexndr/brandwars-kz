import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyChannels } from "@/lib/notify";
import { contestCloseAt, contestWinner, minChallengeKzt } from "@/lib/land";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Siege windows.
 *
 * Taking an occupied cell is deliberately not instant. A challenge opens a
 * timed window with a public counter; both sides can reinforce until it closes,
 * and the higher total takes the cell. That converts a silent number comparison
 * into an event with a clock:
 *
 *   - both sides pay, instead of only the challenger;
 *   - there is a specific time to come back and watch;
 *   - "you are under siege, 4h left" is urgent and honest, where "you were
 *     overtaken, top up" reads as begging;
 *   - the event has a start, an end and a result, so a replay clip can be
 *     generated from it automatically.
 *
 * The losing side's stake is not burned — it becomes wallet credit usable on
 * other cells. Nobody pays for literally nothing, which keeps this clear of
 * refund disputes and chargebacks while the revenue still lands.
 */

export type OpenContestResult =
  | { ok: true; contestId: string; closesAt: Date; joinedExisting: boolean }
  | {
      ok: false;
      reason:
        | "cell_not_found"
        | "not_owned"
        | "own_cell"
        | "underpaid"
        | "arena_mismatch";
      minimumKzt?: number;
    };

export async function openContest(params: {
  cellId: string;
  challengerBrandId: string;
  userId: string;
  amountKzt: number;
  primeTime?: boolean;
}, db: DbClient = prisma): Promise<OpenContestResult> {
  const cell = await db.cell.findUnique({
    where: { id: params.cellId },
    select: {
      id: true,
      arenaId: true,
      state: true,
      priceKzt: true,
      investedKzt: true,
      ownerBrandId: true,
      q: true,
      r: true,
    },
  });

  if (!cell) return { ok: false, reason: "cell_not_found" };
  if (!cell.ownerBrandId || cell.state === "NEUTRAL") {
    return { ok: false, reason: "not_owned" };
  }

  // A cell is under at most one window at a time. Check this *before* the
  // own-cell guard: while a siege is running the owner reaching this entry
  // point is defending, which is legitimate — it is only outside a window that
  // challenging your own cell makes no sense.
  const existing = await db.contest.findFirst({
    where: { cellId: cell.id, status: "OPEN" },
    select: { id: true, closesAt: true, challengerBrandId: true },
  });

  if (existing) {
    const isDefender = cell.ownerBrandId === params.challengerBrandId;
    const isChallenger = existing.challengerBrandId === params.challengerBrandId;

    // Keep a window to two sides. A third brand piling on would make the
    // closing number impossible to reason about and the refund unfair.
    if (!isDefender && !isChallenger) {
      return { ok: false, reason: "own_cell" };
    }

    const minimumJoin = isDefender
      ? TERRITORY_CELL_PRICE_KZT
      : minChallengeKzt(cell.priceKzt, cell.investedKzt);

    if (params.amountKzt < minimumJoin) {
      return { ok: false, reason: "underpaid", minimumKzt: minimumJoin };
    }

    const joined = await addContestBid(
      {
        contestId: existing.id,
        brandId: params.challengerBrandId,
        userId: params.userId,
        amountKzt: params.amountKzt,
        side: isDefender ? "DEFENDER" : "CHALLENGER",
      },
      db,
    );
    if (!joined.ok) {
      return {
        ok: false,
        reason: joined.reason === "closed" ? "not_owned" : "own_cell",
      };
    }

    return {
      ok: true,
      contestId: existing.id,
      closesAt: existing.closesAt,
      joinedExisting: true,
    };
  }

  if (cell.ownerBrandId === params.challengerBrandId) {
    return { ok: false, reason: "own_cell" };
  }

  const minimum = minChallengeKzt(cell.priceKzt, cell.investedKzt);
  if (params.amountKzt < minimum) {
    return { ok: false, reason: "underpaid", minimumKzt: minimum };
  }

  const now = new Date();
  const closesAt = contestCloseAt(now, { primeTime: params.primeTime });

  const createContest = async (tx: Prisma.TransactionClient) => {
    const reserved = await tx.cell.updateMany({
      where: {
        id: cell.id,
        ownerBrandId: cell.ownerBrandId,
        state: { in: ["HELD", "FADING"] },
      },
      data: { state: "CONTESTED" },
    });
    if (reserved.count === 0) return null;

    const created = await tx.contest.create({
      data: {
        cellId: cell.id,
        arenaId: cell.arenaId,
        challengerBrandId: params.challengerBrandId,
        defenderBrandId: cell.ownerBrandId,
        challengerKzt: params.amountKzt,
        defenderKzt: 0,
        opensAt: now,
        closesAt,
        status: "OPEN",
      },
      select: { id: true },
    });

    await tx.contestBid.create({
      data: {
        contestId: created.id,
        brandId: params.challengerBrandId,
        userId: params.userId,
        side: "CHALLENGER",
        amountKzt: params.amountKzt,
      },
    });

    await tx.cellEvent.create({
      data: {
        arenaId: cell.arenaId,
        cellId: cell.id,
        brandId: params.challengerBrandId,
        type: "CONTEST_OPENED",
        amountKzt: params.amountKzt,
        metadata: { q: cell.q, r: cell.r, closesAt: closesAt.toISOString() },
      },
    });

    return created;
  };

  const contest =
    db === prisma
      ? await prisma.$transaction(createContest)
      : await createContest(db as Prisma.TransactionClient);

  if (!contest) return { ok: false, reason: "not_owned" };

  if (db === prisma) {
    void notifyDefenderOfContest(contest.id).catch((error) =>
      console.error("[contest-notify]", error),
    );
  }

  return { ok: true, contestId: contest.id, closesAt, joinedExisting: false };
}

export type AddBidResult =
  | { ok: true; challengerKzt: number; defenderKzt: number }
  | { ok: false; reason: "not_found" | "closed" | "not_a_participant" };

export async function addContestBid(params: {
  contestId: string;
  brandId: string;
  userId: string;
  amountKzt: number;
  side?: "CHALLENGER" | "DEFENDER";
}, db: DbClient = prisma): Promise<AddBidResult> {
  const contest = await db.contest.findUnique({
    where: { id: params.contestId },
    select: {
      id: true,
      status: true,
      closesAt: true,
      challengerBrandId: true,
      defenderBrandId: true,
    },
  });

  if (!contest) return { ok: false, reason: "not_found" };
  if (contest.status !== "OPEN" || contest.closesAt.getTime() <= Date.now()) {
    return { ok: false, reason: "closed" };
  }

  const side =
    params.side ??
    (contest.challengerBrandId === params.brandId
      ? "CHALLENGER"
      : contest.defenderBrandId === params.brandId
        ? "DEFENDER"
        : null);

  if (!side) return { ok: false, reason: "not_a_participant" };

  const addBid = async (tx: Prisma.TransactionClient) => {
    const updated = await tx.contest.updateMany({
      where: {
        id: contest.id,
        status: "OPEN",
        closesAt: { gt: new Date() },
      },
      data:
        side === "CHALLENGER"
          ? { challengerKzt: { increment: params.amountKzt } }
          : { defenderKzt: { increment: params.amountKzt } },
    });
    if (updated.count === 0) return null;

    await tx.contestBid.create({
      data: {
        contestId: contest.id,
        brandId: params.brandId,
        userId: params.userId,
        side,
        amountKzt: params.amountKzt,
      },
    });

    const totals = await tx.contest.findUniqueOrThrow({
      where: { id: contest.id },
      select: { challengerKzt: true, defenderKzt: true, arenaId: true, cellId: true },
    });

    await tx.cellEvent.create({
      data: {
        arenaId: totals.arenaId,
        cellId: totals.cellId,
        brandId: params.brandId,
        type: "REINFORCED",
        amountKzt: params.amountKzt,
        metadata: { side },
      },
    });

    return totals;
  };

  const updated =
    db === prisma
      ? await prisma.$transaction(addBid)
      : await addBid(db as Prisma.TransactionClient);

  if (!updated) return { ok: false, reason: "closed" };

  return {
    ok: true,
    challengerKzt: updated.challengerKzt,
    defenderKzt: updated.defenderKzt,
  };
}

export type ResolveResult =
  | { ok: true; winner: "CHALLENGER" | "DEFENDER"; cellId: string }
  | { ok: false; reason: "not_found" | "already_resolved" | "still_open" };

export async function resolveContest(
  contestId: string,
  options: { force?: boolean } = {},
): Promise<ResolveResult> {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      id: true,
      status: true,
      closesAt: true,
      cellId: true,
      arenaId: true,
      challengerBrandId: true,
      defenderBrandId: true,
      challengerKzt: true,
      defenderKzt: true,
    },
  });

  if (!contest) return { ok: false, reason: "not_found" };
  if (contest.status !== "OPEN") return { ok: false, reason: "already_resolved" };
  if (!options.force && contest.closesAt.getTime() > Date.now()) {
    return { ok: false, reason: "still_open" };
  }

  const winner = contestWinner(contest.challengerKzt, contest.defenderKzt);
  const winnerBrandId =
    winner === "CHALLENGER" ? contest.challengerBrandId : contest.defenderBrandId;
  const losingSide = winner === "CHALLENGER" ? "DEFENDER" : "CHALLENGER";
  const now = new Date();

  const didResolve = await prisma.$transaction(async (tx) => {
    // Guarded update: if another worker resolved this first, count is 0 and we
    // leave everything alone.
    const claimed = await tx.contest.updateMany({
      where: { id: contest.id, status: "OPEN" },
      data: {
        status: "RESOLVED",
        winnerBrandId,
        resolvedAt: now,
      },
    });
    if (claimed.count === 0) return false;

    await tx.cell.update({
      where: { id: contest.cellId },
      data: {
        state: "HELD",
        ownerBrandId: winnerBrandId,
        lastUpkeepAt: now,
        fadingSince: null,
        ...(winner === "CHALLENGER"
          ? { claimedAt: now, investedKzt: contest.challengerKzt }
          : { investedKzt: { increment: contest.defenderKzt } }),
      },
    });

    await tx.cellEvent.create({
      data: {
        arenaId: contest.arenaId,
        cellId: contest.cellId,
        brandId: winnerBrandId,
        type: winner === "CHALLENGER" ? "CONTEST_WON" : "CONTEST_HELD",
        amountKzt:
          winner === "CHALLENGER" ? contest.challengerKzt : contest.defenderKzt,
        metadata: {
          challengerKzt: contest.challengerKzt,
          defenderKzt: contest.defenderKzt,
        },
      },
    });

    // Refund the losing side as spendable credit rather than burning it.
    const losingBids = await tx.contestBid.findMany({
      where: { contestId: contest.id, side: losingSide },
      select: { userId: true, amountKzt: true },
    });

    const perUser = new Map<string, number>();
    for (const bid of losingBids) {
      perUser.set(bid.userId, (perUser.get(bid.userId) ?? 0) + bid.amountKzt);
    }

    for (const [userId, amount] of perUser) {
      if (amount <= 0) continue;
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: { balance: { increment: amount } },
        create: { userId, balance: amount },
        select: { id: true },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "CREDIT",
          amount,
          description: `Возврат ставки за клетку (окно ${contest.id}) — можно потратить на другие клетки`,
        },
      });
    }
    return true;
  });

  if (!didResolve) return { ok: false, reason: "already_resolved" };

  void notifyContestOutcome(contest.id).catch((error) =>
    console.error("[contest-outcome-notify]", error),
  );

  return { ok: true, winner, cellId: contest.cellId };
}

/** Close every window whose time has come. Driven by the cron tick. */
export async function resolveDueContests(
  now = new Date(),
): Promise<{ resolved: number }> {
  const due = await prisma.contest.findMany({
    where: { status: "OPEN", closesAt: { lte: now } },
    select: { id: true },
    take: 200,
  });

  let resolved = 0;
  for (const contest of due) {
    const result = await resolveContest(contest.id);
    if (result.ok) resolved++;
  }

  return { resolved };
}

async function contestParticipantEmail(
  brandId: string | null,
): Promise<string | null> {
  if (!brandId) return null;
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      claims: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { contactEmail: true, submitter: { select: { email: true } } },
      },
    },
  });
  return (
    brand?.claims[0]?.contactEmail ?? brand?.claims[0]?.submitter?.email ?? null
  );
}

export async function notifyDefenderOfContest(contestId: string): Promise<void> {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      closesAt: true,
      challengerKzt: true,
      challengerBrand: { select: { name: true } },
      defenderBrandId: true,
      defenderBrand: { select: { name: true } },
      cell: { select: { q: true, r: true, ring: true } },
    },
  });
  if (!contest?.defenderBrandId) return;

  const email = await contestParticipantEmail(contest.defenderBrandId);
  if (!email) return;

  const hoursLeft = Math.max(
    1,
    Math.round((contest.closesAt.getTime() - Date.now()) / 3_600_000),
  );

  const text = [
    `Ваша клетка под окном противостояния.`,
    `Претендент: «${contest.challengerBrand.name}», ставка ${contest.challengerKzt.toLocaleString("ru-KZ")} ₸.`,
    `До закрытия окна: ~${hoursLeft} ч.`,
    ``,
    `Чтобы удержать клетку, добавьте больше претендента до закрытия.`,
    `При равных суммах клетка остаётся у вас.`,
    ``,
    `Если не удержите — ставка вернётся на баланс и её можно потратить на другие клетки.`,
    ``,
    `BrandWars.kz — игровая метрика, не оценка качества бренда.`,
  ].join("\n");

  await notifyChannels({
    toEmail: email,
    telegramChatId: null,
    subject: `Окно противостояния: «${contest.challengerBrand.name}» претендует на вашу клетку`,
    text,
    html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
  });
}

async function notifyContestOutcome(contestId: string): Promise<void> {
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      challengerKzt: true,
      defenderKzt: true,
      winnerBrandId: true,
      challengerBrandId: true,
      challengerBrand: { select: { name: true } },
      defenderBrandId: true,
      defenderBrand: { select: { name: true } },
    },
  });
  if (!contest) return;

  const challengerWon = contest.winnerBrandId === contest.challengerBrandId;

  const recipients = [
    { brandId: contest.challengerBrandId, won: challengerWon },
    { brandId: contest.defenderBrandId, won: !challengerWon },
  ];

  for (const recipient of recipients) {
    const email = await contestParticipantEmail(recipient.brandId);
    if (!email) continue;

    const text = recipient.won
      ? [
          `Клетка ваша.`,
          `Итог окна: ${contest.challengerKzt.toLocaleString("ru-KZ")} ₸ против ${contest.defenderKzt.toLocaleString("ru-KZ")} ₸.`,
        ].join("\n")
      : [
          `Клетка осталась за соперником.`,
          `Итог окна: ${contest.challengerKzt.toLocaleString("ru-KZ")} ₸ против ${contest.defenderKzt.toLocaleString("ru-KZ")} ₸.`,
          ``,
          `Ваша ставка возвращена на баланс — её можно потратить на другие клетки.`,
        ].join("\n");

    await notifyChannels({
      toEmail: email,
      telegramChatId: null,
      subject: recipient.won
        ? "Окно закрыто: клетка ваша"
        : "Окно закрыто: клетка осталась за соперником",
      text,
      html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
    });
  }
}
