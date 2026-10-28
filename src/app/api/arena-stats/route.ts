import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveArena } from "@/lib/arena";
import { minChallengeKzt } from "@/lib/land";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";

export const dynamic = "force-dynamic";

/**
 * Selling metrics for a continent panel.
 *
 * Every number here is computed from this arena's real history. That is a hard
 * rule, not a style preference: a "chance of holding" figure that was not
 * derived from actual outcomes would be a fabricated statistic shown to induce
 * a payment — misleading advertising, and squarely what consumer-protection law
 * targets. Where there is no history yet, the field comes back null with its
 * sample size so the UI can say "not enough data" instead of inventing
 * confidence.
 */

const SPEND_TYPES = [
  "BRAND_ENTRY",
  "TOP_UP",
  "CELL_CLAIM",
  "CELL_UPKEEP",
  "CONTEST_BID",
] as const;

function toStep(amount: number): number {
  return Math.ceil(amount / TERRITORY_CELL_PRICE_KZT) * TERRITORY_CELL_PRICE_KZT;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export async function GET(request: NextRequest) {
  const categorySlug = request.nextUrl.searchParams.get("category");
  const scopeSlug = request.nextUrl.searchParams.get("scope") ?? "kz";
  const locale = request.nextUrl.searchParams.get("locale") ?? "ru";

  if (!categorySlug) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const arena = await resolveArena({ categorySlug, scopeSlug });
  if (!arena) {
    return NextResponse.json({ error: "Arena not found" }, { status: 404 });
  }

  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { slug: true, nameRu: true, nameKk: true, continentRu: true, continentKk: true, color: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const dayAgo = new Date(Date.now() - 86_400_000);

  const [
    cells,
    freeCells,
    cheapestFree,
    territories,
    contestsResolved,
    openContests,
    releasedLast24h,
  ] = await Promise.all([
    prisma.cell.count({ where: { arenaId: arena.arenaId, layer: { not: "CAPITAL" } } }),
    prisma.cell.count({ where: { arenaId: arena.arenaId, state: "NEUTRAL", layer: { not: "CAPITAL" } } }),
    prisma.cell.findFirst({
      where: { arenaId: arena.arenaId, state: "NEUTRAL", layer: { not: "CAPITAL" } },
      orderBy: [{ priceKzt: "asc" }, { ring: "desc" }],
      select: { priceKzt: true, ring: true, layer: true, q: true, r: true },
    }),
    prisma.territory.findMany({
      where: { seasonCategoryId: arena.seasonCategoryId },
      orderBy: { rank: "asc" },
      select: {
        rank: true,
        cellCount: true,
        battlePower: true,
        brand: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
            clickCount: true,
            verificationStatus: true,
            claims: { orderBy: { createdAt: "desc" }, take: 1, select: { metadata: true } },
          },
        },
      },
    }),
    prisma.contest.findMany({
      where: { arenaId: arena.arenaId, status: "RESOLVED" },
      select: {
        winnerBrandId: true,
        challengerBrandId: true,
        challengerKzt: true,
        defenderKzt: true,
        opensAt: true,
        resolvedAt: true,
      },
    }),
    prisma.contest.count({ where: { arenaId: arena.arenaId, status: "OPEN" } }),
    prisma.cellEvent.count({
      where: { arenaId: arena.arenaId, type: "RELEASED", createdAt: { gte: dayAgo } },
    }),
  ]);

  const brandIds = territories.map((t) => t.brand.id);

  const [spendRows, clicksLast24h, claimEvents] = await Promise.all([
    brandIds.length
      ? prisma.transaction.groupBy({
          by: ["brandId"],
          where: {
            brandId: { in: brandIds },
            status: "COMPLETED",
            type: { in: [...SPEND_TYPES] },
          },
          _sum: { amountKzt: true },
        })
      : Promise.resolve([] as { brandId: string | null; _sum: { amountKzt: number | null } }[]),
    brandIds.length
      ? prisma.brandClick.count({
          where: { brandId: { in: brandIds }, createdAt: { gte: dayAgo } },
        })
      : Promise.resolve(0),
    prisma.cellEvent.findMany({
      where: { arenaId: arena.arenaId, type: "CLAIMED" },
      select: { amountKzt: true },
      take: 300,
    }),
  ]);

  const spendBy = new Map(
    spendRows.map((r) => [r.brandId as string, r._sum.amountKzt ?? 0]),
  );

  // --- honest defence rate: only from contests that actually finished ---
  const defencesHeld = contestsResolved.filter(
    (c) => c.winnerBrandId !== c.challengerBrandId,
  ).length;
  const defenceRate =
    contestsResolved.length > 0
      ? Math.round((defencesHeld / contestsResolved.length) * 100)
      : null;

  const medianWinningBid = median(
    contestsResolved.map((c) => Math.max(c.challengerKzt, c.defenderKzt)),
  );

  const medianClaimSpend = median(
    claimEvents.map((e) => e.amountKzt ?? 0).filter((n) => n > 0),
  );

  const leader = territories[0] ?? null;
  const leaderSpend = leader ? spendBy.get(leader.brand.id) ?? 0 : 0;
  const occupancy = cells > 0 ? (cells - freeCells) / cells : 0;

  const participants = territories.map((t) => {
    const meta = (t.brand.claims[0]?.metadata ?? {}) as Record<string, unknown>;
    const amountKzt = spendBy.get(t.brand.id) ?? 0;
    return {
      rank: t.rank,
      slug: t.brand.slug,
      name: t.brand.name,
      logoUrl: t.brand.logoUrl ?? (typeof meta.favicon === "string" ? meta.favicon : null),
      verified: t.brand.verificationStatus === "VERIFIED",
      cellCount: t.cellCount,
      clickCount: t.brand.clickCount,
      amountKzt,
      takeThisPlaceKzt: toStep(amountKzt + 1),
    };
  });

  return NextResponse.json({
    category: {
      slug: category.slug,
      name: locale === "kk" ? category.nameKk : category.nameRu,
      continent: locale === "kk" ? category.continentKk : category.continentRu,
      color: category.color,
    },
    scope: {
      slug: arena.scopeSlug,
      name: locale === "kk" ? arena.scopeNameKk : arena.scopeNameRu,
    },

    // --- what it costs to get in and to get to the top ---
    pricing: {
      entryMinimumKzt: 1000,
      cheapestFreeCellKzt: cheapestFree?.priceKzt ?? null,
      cheapestFreeCell: cheapestFree
        ? { q: cheapestFree.q, r: cheapestFree.r, ring: cheapestFree.ring, layer: cheapestFree.layer }
        : null,
      takeFirstPlaceKzt: leader ? toStep(leaderSpend + 1) : 1000,
      // What it takes to open a window on the leader's own ground.
      challengeLeaderFromKzt: leader
        ? minChallengeKzt(TERRITORY_CELL_PRICE_KZT * 3, leaderSpend)
        : null,
      medianClaimSpendKzt: medianClaimSpend,
      medianWinningBidKzt: medianWinningBid,
    },

    // --- how crowded it is: the real answer to "can I get in right now" ---
    capacity: {
      totalCells: cells,
      freeCells,
      occupancyPercent: Math.round(occupancy * 100),
      // Free land means immediate entry — no contest needed.
      canEnterWithoutContest: freeCells > 0,
      releasedLast24h,
      frontierRadius: arena.frontierRadius,
      coreRadius: arena.coreRadius,
    },

    // --- outcomes, with sample sizes so the UI never overstates them ---
    outcomes: {
      contestsFinished: contestsResolved.length,
      defenceHeldPercent: defenceRate,
      defenceSample: contestsResolved.length,
      openContests,
    },

    // --- what a brand actually got here ---
    attention: {
      participants: participants.length,
      clicksLast24h,
      totalClicks: participants.reduce((sum, p) => sum + p.clickCount, 0),
      medianClicksPerBrand: median(participants.map((p) => p.clickCount)),
    },

    leader: participants[0] ?? null,
    participants,
  });
}
