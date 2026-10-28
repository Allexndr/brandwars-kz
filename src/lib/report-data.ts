import "server-only";

import { prisma } from "@/lib/prisma";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";

/**
 * Live numbers for the indexable report pages.
 *
 * These pages are the GEO play: language models cite recent, specific,
 * attributed facts, and this platform produces them continuously by itself
 * ("as of 27.08.2026 the leader in Travel in Kazakhstan is X with N cells").
 * Citation drops off sharply once a page is more than three months old, so the
 * value is entirely in the numbers being real and current — which also means
 * never padding a thin dataset with an invented figure.
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

export type CategoryReportRow = {
  slug: string;
  name: string;
  continent: string;
  color: string;
  brandCount: number;
  freeCells: number;
  totalCells: number;
  occupancyPercent: number;
  cheapestEntryKzt: number;
  takeFirstPlaceKzt: number;
  leaderName: string | null;
  leaderSlug: string | null;
  clicksLast24h: number;
};

export type PlatformReport = {
  generatedAt: Date;
  totals: {
    categories: number;
    brands: number;
    verifiedBrands: number;
    heldCells: number;
    freeCells: number;
    openContests: number;
    clicksLast24h: number;
    clicksTotal: number;
  };
  rows: CategoryReportRow[];
};

/**
 * One pass over the platform, shaped for a report page. Deliberately a small
 * fixed number of aggregate queries rather than per-category loops.
 */
export async function buildPlatformReport(): Promise<PlatformReport> {
  const dayAgo = new Date(Date.now() - 86_400_000);

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      nameRu: true,
      continentRu: true,
      color: true,
    },
  });

  if (!activeSeason) {
    return {
      generatedAt: new Date(),
      totals: {
        categories: categories.length,
        brands: 0,
        verifiedBrands: 0,
        heldCells: 0,
        freeCells: 0,
        openContests: 0,
        clicksLast24h: 0,
        clicksTotal: 0,
      },
      rows: [],
    };
  }

  const seasonCategories = await prisma.seasonCategory.findMany({
    where: { seasonId: activeSeason.id },
    select: {
      id: true,
      categoryId: true,
      territories: {
        orderBy: { rank: "asc" },
        select: {
          rank: true,
          brand: { select: { id: true, slug: true, name: true, clickCount: true } },
        },
      },
      arenas: { select: { id: true } },
    },
  });

  const allArenaIds = seasonCategories.flatMap((sc) => sc.arenas.map((a) => a.id));
  const allBrandIds = seasonCategories.flatMap((sc) =>
    sc.territories.map((t) => t.brand.id),
  );

  const [cellsByArena, spendRows, clicksLast24hRows, totals] = await Promise.all([
    allArenaIds.length
      ? prisma.cell.groupBy({
          by: ["arenaId", "state"],
          where: { arenaId: { in: allArenaIds }, layer: { not: "CAPITAL" } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { arenaId: string; state: string; _count: { _all: number } }[]),
    allBrandIds.length
      ? prisma.transaction.groupBy({
          by: ["brandId"],
          where: {
            brandId: { in: allBrandIds },
            status: "COMPLETED",
            type: { in: [...SPEND_TYPES] },
          },
          _sum: { amountKzt: true },
        })
      : Promise.resolve([] as { brandId: string | null; _sum: { amountKzt: number | null } }[]),
    allBrandIds.length
      ? prisma.brandClick.groupBy({
          by: ["brandId"],
          where: { brandId: { in: allBrandIds }, createdAt: { gte: dayAgo } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { brandId: string; _count: { _all: number } }[]),
    Promise.all([
      prisma.brand.count({ where: { isActive: true } }),
      prisma.brand.count({ where: { isActive: true, verificationStatus: "VERIFIED" } }),
      prisma.contest.count({ where: { status: "OPEN" } }),
      prisma.brandClick.count(),
    ]),
  ]);

  const spendBy = new Map(
    spendRows.map((r) => [r.brandId as string, r._sum.amountKzt ?? 0]),
  );
  const clicks24By = new Map(
    clicksLast24hRows.map((r) => [r.brandId, r._count._all]),
  );

  const cellsFor = (arenaIds: string[]) => {
    let free = 0;
    let total = 0;
    for (const row of cellsByArena) {
      if (!arenaIds.includes(row.arenaId)) continue;
      total += row._count._all;
      if (row.state === "NEUTRAL") free += row._count._all;
    }
    return { free, total };
  };

  const scByCategory = new Map(seasonCategories.map((sc) => [sc.categoryId, sc]));

  const rows: CategoryReportRow[] = categories.map((category) => {
    const sc = scByCategory.get(category.id);
    const arenaIds = sc?.arenas.map((a) => a.id) ?? [];
    const { free, total } = cellsFor(arenaIds);
    const leader = sc?.territories[0] ?? null;
    const leaderSpend = leader ? spendBy.get(leader.brand.id) ?? 0 : 0;

    const clicks24 =
      sc?.territories.reduce(
        (sum, t) => sum + (clicks24By.get(t.brand.id) ?? 0),
        0,
      ) ?? 0;

    return {
      slug: category.slug,
      name: category.nameRu,
      continent: category.continentRu,
      color: category.color,
      brandCount: sc?.territories.length ?? 0,
      freeCells: free,
      totalCells: total,
      occupancyPercent: total > 0 ? Math.round(((total - free) / total) * 100) : 0,
      cheapestEntryKzt: 1000,
      takeFirstPlaceKzt: leader ? toStep(leaderSpend + 1) : 1000,
      leaderName: leader?.brand.name ?? null,
      leaderSlug: leader?.brand.slug ?? null,
      clicksLast24h: clicks24,
    };
  });

  const heldTotal = cellsByArena
    .filter((r) => r.state !== "NEUTRAL")
    .reduce((sum, r) => sum + r._count._all, 0);
  const freeTotal = cellsByArena
    .filter((r) => r.state === "NEUTRAL")
    .reduce((sum, r) => sum + r._count._all, 0);

  const [brandCount, verifiedCount, openContests, clicksTotal] = totals;

  return {
    generatedAt: new Date(),
    totals: {
      categories: categories.length,
      brands: brandCount,
      verifiedBrands: verifiedCount,
      heldCells: heldTotal,
      freeCells: freeTotal,
      openContests,
      clicksLast24h: [...clicks24By.values()].reduce((a, b) => a + b, 0),
      clicksTotal,
    },
    rows,
  };
}

/** Formats a date the way the report pages cite themselves. */
export function reportDate(date: Date): string {
  return date.toLocaleDateString("ru-KZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
