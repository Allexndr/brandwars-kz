import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkoutProviderSchema } from "@/lib/payments/methods";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveArena } from "@/lib/arena";
import { minChallengeKzt } from "@/lib/land";
import { purchaseLand } from "@/lib/land-purchase";
import { assertBrandAccess } from "@/lib/brand-access";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";
import { resolveDueContests } from "@/lib/contest";

export const dynamic = "force-dynamic";

/**
 * Open siege windows, newest closing first — the feed that makes the planet
 * watchable. Public on purpose: the running counter is the spectacle.
 */
export async function GET(request: NextRequest) {
  // Hobby deployments run a daily safety cron. Public reads also settle due
  // six-hour windows so the displayed result is never hours out of date.
  await resolveDueContests();
  const categorySlug = request.nextUrl.searchParams.get("category");
  const scopeSlug = request.nextUrl.searchParams.get("scope") ?? "kz";
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 50),
    100,
  );

  let arenaId: string | undefined;
  if (categorySlug) {
    const arena = await resolveArena({ categorySlug, scopeSlug });
    if (!arena) {
      return NextResponse.json({ error: "Arena not found" }, { status: 404 });
    }
    arenaId = arena.arenaId;
  }

  const contests = await prisma.contest.findMany({
    where: { status: "OPEN", ...(arenaId ? { arenaId } : {}) },
    orderBy: { closesAt: "asc" },
    take: limit,
    select: {
      id: true,
      closesAt: true,
      opensAt: true,
      challengerKzt: true,
      defenderKzt: true,
      cell: {
        select: {
          q: true,
          r: true,
          ring: true,
          layer: true,
          arena: {
            select: {
              scope: { select: { slug: true, nameRu: true, nameKk: true } },
              seasonCategory: {
                select: { category: { select: { slug: true, nameRu: true } } },
              },
            },
          },
        },
      },
      challengerBrand: { select: { slug: true, name: true, logoUrl: true } },
      defenderBrand: { select: { slug: true, name: true, logoUrl: true } },
    },
  });

  return NextResponse.json({
    contests: contests.map((contest) => ({
      id: contest.id,
      opensAt: contest.opensAt,
      closesAt: contest.closesAt,
      challengerKzt: contest.challengerKzt,
      defenderKzt: contest.defenderKzt,
      // Ties go to the defender, so the challenger must strictly exceed.
      leading:
        contest.challengerKzt > contest.defenderKzt ? "CHALLENGER" : "DEFENDER",
      gapKzt: Math.abs(contest.challengerKzt - contest.defenderKzt),
      cell: {
        q: contest.cell.q,
        r: contest.cell.r,
        ring: contest.cell.ring,
        layer: contest.cell.layer,
      },
      category: contest.cell.arena.seasonCategory.category,
      scope: contest.cell.arena.scope,
      challenger: contest.challengerBrand,
      defender: contest.defenderBrand,
    })),
  });
}

const openSchema = z.object({
  brandId: z.string(),
  cellId: z.string(),
  amountKzt: z.number().int().min(500).multipleOf(500),
  /** Align the close to daily prime time instead of a rolling window. */
  primeTime: z.boolean().optional(),
  provider: checkoutProviderSchema.default("prodamus"),
  phone: z.string().min(10).max(30).optional(),
});

/** Challenge an occupied cell, or reinforce a window already running on it. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = openSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const access = await assertBrandAccess(session.user.id, parsed.data.brandId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const cell = await prisma.cell.findUnique({
    where: { id: parsed.data.cellId },
    select: {
      id: true,
      state: true,
      priceKzt: true,
      investedKzt: true,
      ownerBrandId: true,
      arena: {
        select: {
          seasonCategoryId: true,
          seasonCategory: { select: { categoryId: true } },
        },
      },
      contests: {
        where: { status: "OPEN" },
        select: { challengerBrandId: true },
        take: 1,
      },
    },
  });

  if (!cell) {
    return NextResponse.json({ error: "Cell not found" }, { status: 404 });
  }
  if (access.primaryCategoryId !== cell.arena.seasonCategory.categoryId) {
    return NextResponse.json(
      { error: "Бренд может участвовать только в своей категории" },
      { status: 403 },
    );
  }
  if (!cell.ownerBrandId || cell.state === "NEUTRAL") {
    return NextResponse.json(
      { error: "Клетка свободна — её можно занять без окна" },
      { status: 409 },
    );
  }

  // Pre-check so nobody is sent to a payment page for an action that will fail.
  // While a window is open the owner arriving here is defending, so the
  // own-cell rejection only applies outside a window.
  const openContestOnCell = cell.contests[0];
  const isDefender = cell.ownerBrandId === parsed.data.brandId;

  if (!openContestOnCell && isDefender) {
    return NextResponse.json(
      { error: "Нельзя открыть окно против своей клетки" },
      { status: 409 },
    );
  }

  if (
    openContestOnCell &&
    !isDefender &&
    openContestOnCell.challengerBrandId !== parsed.data.brandId
  ) {
    return NextResponse.json(
      { error: "В окне уже участвуют две стороны" },
      { status: 409 },
    );
  }

  const minimum = isDefender
    ? TERRITORY_CELL_PRICE_KZT
    : minChallengeKzt(cell.priceKzt, cell.investedKzt);

  if (parsed.data.amountKzt < minimum) {
    return NextResponse.json(
      { error: "Ставка ниже минимальной", minimumKzt: minimum },
      { status: 400 },
    );
  }

  const outcome = await purchaseLand({
    intent: {
      kind: "contest_open",
      cellId: cell.id,
      brandId: parsed.data.brandId,
      primeTime: parsed.data.primeTime,
    },
    userId: session.user.id,
    amountKzt: parsed.data.amountKzt,
    seasonCategoryId: cell.arena.seasonCategoryId,
    paymentProvider: parsed.data.provider,
    phone: parsed.data.phone,
  });

  if (outcome.status === "error") {
    return NextResponse.json({ error: outcome.reason }, { status: 409 });
  }

  return NextResponse.json(outcome, {
    status: outcome.status === "applied" ? 201 : 202,
  });
}
