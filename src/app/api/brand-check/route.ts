import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeWebsiteUrl } from "@/lib/normalize-url";
import { fetchUrlMetadata } from "@/lib/metadata-fetch";
import { suggestCategory, TERRITORY_CELL_PRICE_KZT, ENTRY_PRICE_KZT } from "@/lib/category-catalog";
import { syncCategoryCatalog } from "@/lib/category-sync";
import { resolveArena } from "@/lib/arena";
import { clientIpFrom, hashIdentifier } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * Free, no-signup brand report — the front door.
 *
 * Product-led growth lives or dies on how fast a visitor reaches the moment
 * where the value is obvious, and a signup wall before that moment is the
 * single most expensive thing on the funnel. So this asks for a URL and nothing
 * else, and answers with numbers nobody else has: what the leader in this
 * category actually paid, how much traffic that bought, and what it would cost
 * to take a place.
 *
 * Every figure is real. A made-up "your projected position" would be a
 * fabricated statistic used to induce a payment, so where the data is thin the
 * response says so instead.
 */
const schema = z.object({
  url: z.string().min(3).transform(normalizeWebsiteUrl).pipe(z.string().url()),
});

/** Light abuse brake: this endpoint fetches an arbitrary URL. */
const MAX_CHECKS_PER_HOUR = 30;
const recentChecks = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hourAgo = now - 3_600_000;
  const hits = (recentChecks.get(key) ?? []).filter((t) => t > hourAgo);
  hits.push(now);
  recentChecks.set(key, hits);
  // Keep the map from growing without bound in a long-lived instance.
  if (recentChecks.size > 5000) recentChecks.clear();
  return hits.length > MAX_CHECKS_PER_HOUR;
}

function toStep(amount: number): number {
  return Math.ceil(amount / TERRITORY_CELL_PRICE_KZT) * TERRITORY_CELL_PRICE_KZT;
}

const SPEND_TYPES = [
  "BRAND_ENTRY",
  "TOP_UP",
  "CELL_CLAIM",
  "CELL_UPKEEP",
  "CONTEST_BID",
] as const;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте ссылку" }, { status: 400 });
  }

  const ip = clientIpFrom(request.headers);
  if (ip !== "unknown" && rateLimited(hashIdentifier(ip))) {
    return NextResponse.json(
      { error: "Слишком много проверок. Попробуйте через час." },
      { status: 429 },
    );
  }

  const url = parsed.data.url;
  await syncCategoryCatalog().catch(() => undefined);

  const metadata = await fetchUrlMetadata(url).catch(() => null);
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const brandName = metadata?.title?.trim() || hostname;

  // Is this brand already on the map? Answering that is half the hook.
  const existing = await prisma.brand.findFirst({
    where: {
      isActive: true,
      OR: [
        { websiteUrl: { contains: hostname, mode: "insensitive" } },
        { normalizedName: brandName.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "") },
      ],
    },
    select: {
      slug: true,
      name: true,
      clickCount: true,
      primaryCategoryId: true,
      territories: {
        orderBy: { rank: "asc" },
        take: 1,
        select: { rank: true, cellCount: true },
      },
    },
  });

  // A brand already on the map has a real category — guessing one for it would
  // report the wrong market entirely, which is how this first shipped.
  const guess = suggestCategory(
    `${url} ${metadata?.title ?? ""} ${metadata?.description ?? ""}`,
  );

  const category = existing
    ? await prisma.category.findUnique({
        where: { id: existing.primaryCategoryId },
        select: { slug: true, nameRu: true, continentRu: true, color: true, id: true },
      })
    : await prisma.category.findUnique({
        where: { slug: guess.slug },
        select: { slug: true, nameRu: true, continentRu: true, color: true, id: true },
      });

  if (!category) {
    return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
  }

  const arena = await resolveArena({ categorySlug: category.slug, scopeSlug: "kz" });

  const [territories, freeCells, cheapestFree] = await Promise.all([
    prisma.territory.findMany({
      where: { seasonCategory: { categoryId: category.id } },
      orderBy: { rank: "asc" },
      select: {
        rank: true,
        cellCount: true,
        brand: { select: { id: true, slug: true, name: true, clickCount: true } },
      },
    }),
    arena
      ? prisma.cell.count({
          where: { arenaId: arena.arenaId, state: "NEUTRAL", layer: { not: "CAPITAL" } },
        })
      : Promise.resolve(0),
    arena
      ? prisma.cell.findFirst({
          where: { arenaId: arena.arenaId, state: "NEUTRAL", layer: { not: "CAPITAL" } },
          orderBy: { priceKzt: "asc" },
          select: { priceKzt: true },
        })
      : Promise.resolve(null),
  ]);

  const brandIds = territories.map((t) => t.brand.id);
  const spendRows = brandIds.length
    ? await prisma.transaction.groupBy({
        by: ["brandId"],
        where: {
          brandId: { in: brandIds },
          status: "COMPLETED",
          type: { in: [...SPEND_TYPES] },
        },
        _sum: { amountKzt: true },
      })
    : [];

  const spendBy = new Map(
    spendRows.map((r) => [r.brandId as string, r._sum.amountKzt ?? 0]),
  );

  const leader = territories[0] ?? null;
  const leaderSpend = leader ? spendBy.get(leader.brand.id) ?? 0 : 0;
  const leaderClicks = leader?.brand.clickCount ?? 0;

  // Cost per click among current participants — the only honest ROI figure we
  // can offer, and only when there are enough clicks to mean anything.
  const totalSpend = [...spendBy.values()].reduce((a, b) => a + b, 0);
  const totalClicks = territories.reduce((sum, t) => sum + t.brand.clickCount, 0);
  const costPerClick =
    totalClicks >= 10 ? Math.round(totalSpend / totalClicks) : null;

  // Where the entry amount would land: computed against real spends, not
  // guessed. Ties are resolved in favour of the incumbent.
  const entryAmount = ENTRY_PRICE_KZT;
  const wouldBeatCount = territories.filter(
    (t) => (spendBy.get(t.brand.id) ?? 0) < entryAmount,
  ).length;
  const projectedRank = territories.length - wouldBeatCount + 1;

  return NextResponse.json({
    input: { url, hostname },
    brand: {
      name: brandName,
      description: metadata?.description ?? null,
      favicon: metadata?.favicon ?? null,
    },
    alreadyOnMap: existing
      ? {
          slug: existing.slug,
          name: existing.name,
          rank: existing.territories[0]?.rank ?? null,
          cellCount: existing.territories[0]?.cellCount ?? 0,
          clickCount: existing.clickCount,
        }
      : null,
    category: {
      slug: category.slug,
      name: category.nameRu,
      continent: category.continentRu,
      color: category.color,
      /** False when taken from a brand already on the map. */
      guessed: !existing,
    },
    market: {
      participants: territories.length,
      leaderName: leader?.brand.name ?? null,
      leaderSpendKzt: leader ? leaderSpend : null,
      leaderClicks: leader ? leaderClicks : null,
      totalClicks,
      costPerClickKzt: costPerClick,
      freeCells,
      canEnterNow: freeCells > 0,
    },
    yourEntry: {
      entryKzt: entryAmount,
      cheapestFreeCellKzt: cheapestFree?.priceKzt ?? null,
      // Null when the category is empty — there is no position to project.
      projectedRank: territories.length > 0 ? projectedRank : 1,
      takeFirstPlaceKzt: leader ? toStep(leaderSpend + 1) : entryAmount,
    },
  });
}
