import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankLabel } from "@/lib/territory";
import { clickCountSince } from "@/lib/analytics";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";

export const dynamic = "force-dynamic";

/** Spend that counts toward a brand's standing. */
const SPEND_TYPES = [
  "BRAND_ENTRY",
  "TOP_UP",
  "CELL_CLAIM",
  "CELL_UPKEEP",
  "CONTEST_BID",
] as const;

/** Round up to the next payment step so the shown price is always payable. */
function toStep(amount: number): number {
  return Math.ceil(amount / TERRITORY_CELL_PRICE_KZT) * TERRITORY_CELL_PRICE_KZT;
}

/**
 * The leaderboard behind the rich cards.
 *
 * Every row carries what a buyer needs to decide in one glance: what the brand
 * is, how much traffic the spot actually delivered, what it cost, and the exact
 * price to take that place. The last one is the difference between a table you
 * read and a list you buy from.
 *
 * All aggregates are groupBy queries, so cost does not grow with brand count.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const categorySlug = searchParams.get("category");
  const period = searchParams.get("period") ?? "all";
  const locale = searchParams.get("locale") ?? "ru";
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeSeason) {
    return NextResponse.json({ entries: [], period });
  }

  const dayAgo = new Date(Date.now() - 86_400_000);
  const isToday = period === "today";

  const seasonCategories = await prisma.seasonCategory.findMany({
    where: {
      seasonId: activeSeason.id,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: {
      category: true,
      territories: {
        include: {
          brand: {
            select: {
              id: true,
              slug: true,
              name: true,
              websiteUrl: true,
              logoUrl: true,
              clickCount: true,
              verificationStatus: true,
              claims: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { metadata: true },
              },
            },
          },
        },
        orderBy: { rank: "asc" },
      },
    },
  });

  const brandIds = seasonCategories.flatMap((sc) =>
    sc.territories.map((t) => t.brand.id),
  );

  if (brandIds.length === 0) {
    return NextResponse.json({ season: activeSeason.slug, period, entries: [] });
  }

  const [spendAll, spendToday, lastActivity, clicksToday] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["brandId"],
      where: {
        brandId: { in: brandIds },
        status: "COMPLETED",
        type: { in: [...SPEND_TYPES] },
      },
      _sum: { amountKzt: true },
    }),
    prisma.transaction.groupBy({
      by: ["brandId"],
      where: {
        brandId: { in: brandIds },
        status: "COMPLETED",
        type: { in: [...SPEND_TYPES] },
        createdAt: { gte: dayAgo },
      },
      _sum: { amountKzt: true },
    }),
    prisma.transaction.groupBy({
      by: ["brandId"],
      where: { brandId: { in: brandIds }, status: "COMPLETED" },
      _max: { createdAt: true },
    }),
    clickCountSince(brandIds, dayAgo),
  ]);

  const spendAllBy = new Map(
    spendAll.map((r) => [r.brandId as string, r._sum.amountKzt ?? 0]),
  );
  const spendTodayBy = new Map(
    spendToday.map((r) => [r.brandId as string, r._sum.amountKzt ?? 0]),
  );
  const lastActivityBy = new Map(
    lastActivity.map((r) => [r.brandId as string, r._max.createdAt]),
  );

  const rows = seasonCategories.flatMap((sc) =>
    sc.territories.map((t) => {
      const meta = (t.brand.claims[0]?.metadata ?? {}) as Record<string, unknown>;
      const amountKzt = spendAllBy.get(t.brand.id) ?? 0;
      let domain: string | null = null;
      try {
        if (t.brand.websiteUrl) {
          domain = new URL(t.brand.websiteUrl).hostname.replace(/^www\./, "");
        }
      } catch {
        domain = null;
      }

      return {
        brandId: t.brand.id,
        brandSlug: t.brand.slug,
        brandName: t.brand.name,
        description:
          typeof meta.description === "string" ? meta.description : null,
        favicon: t.brand.logoUrl ?? (typeof meta.favicon === "string" ? meta.favicon : null),
        domain,
        // Always the tracked redirect, never the raw link — otherwise the
        // click number the brand is paying for never gets recorded.
        goUrl: t.brand.websiteUrl ? `/api/go/${t.brand.slug}` : null,
        categorySlug: sc.category.slug,
        categoryName: locale === "kk" ? sc.category.nameKk : sc.category.nameRu,
        categoryColor: sc.category.color,
        rank: t.rank,
        rankLabel: getRankLabel(t.rank, locale),
        cellCount: t.cellCount,
        territoryShare: t.territoryShare,
        battlePower: t.battlePower,
        clickCount: t.brand.clickCount,
        clicksToday: clicksToday.get(t.brand.id) ?? 0,
        amountKzt,
        amountTodayKzt: spendTodayBy.get(t.brand.id) ?? 0,
        // The price shown on the button: strictly more than this brand paid.
        takeThisPlaceKzt: toStep(amountKzt + 1),
        lastActivityAt: lastActivityBy.get(t.brand.id) ?? null,
        verificationStatus: t.brand.verificationStatus,
      };
    }),
  );

  if (isToday) {
    rows.sort(
      (a, b) => b.amountTodayKzt - a.amountTodayKzt || a.rank - b.rank,
    );
  } else if (period === "community") {
    rows.sort((a, b) => b.battlePower - a.battlePower);
  } else {
    rows.sort((a, b) => a.rank - b.rank);
  }

  const entries = rows.slice(0, limit).map((row, index) => ({
    ...row,
    // In a filtered or re-sorted view the position shown is the position in
    // *this* list, while `rank` stays the true season rank.
    displayRank: index + 1,
  }));

  return NextResponse.json({
    season: activeSeason.slug,
    period,
    entryMinimumKzt: seasonCategories[0]?.entryMinimumKzt ?? 1000,
    topPlaceKzt: entries.length > 0 ? entries[0].takeThisPlaceKzt : null,
    entries,
  });
}
