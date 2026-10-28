import "server-only";

import { prisma } from "@/lib/prisma";
import { normalizeBrandName } from "@/lib/utils";
import { syncCategoryCatalog } from "@/lib/category-sync";
import { ensureArena, ensureScopes, claimCell } from "@/lib/arena";
import { recalculateCategory } from "@/lib/territory";

export const FOUNDERS = [
  {
    slug: "murdasoft",
    name: "MurdaSoft",
    websiteUrl: "https://murdasoft.kz",
    categorySlug: "code",
    amountKzt: 5000,
  },
  {
    slug: "neurokids",
    name: "NeuroKids",
    websiteUrl: "https://neurokids.kz",
    categorySlug: "education",
    amountKzt: 5000,
  },
] as const;

/**
 * Place the two house brands on real land with a completed 5 000 ₸ payment,
 * so the map and leaderboard show them like any other paid participant.
 */
export async function placeFounderBrands() {
  await syncCategoryCatalog();
  await ensureScopes();

  const season = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startsAt: "desc" },
  });
  if (!season) throw new Error("No active season");

  const scope = await prisma.scope.findUnique({ where: { slug: "kz" } });
  if (!scope) throw new Error("kz scope missing");

  const owner = await prisma.user.upsert({
    where: { email: "founders@brandwars.kz" },
    update: { name: "BrandWars Founders", role: "BRAND_OWNER" },
    create: {
      email: "founders@brandwars.kz",
      name: "BrandWars Founders",
      role: "BRAND_OWNER",
      profile: { create: { locale: "ru" } },
      wallet: { create: { balance: 0 } },
    },
  });

  const results: Array<{
    slug: string;
    categorySlug: string;
    brandId: string;
    cellId: string | null;
    amountKzt: number;
    alreadyPlaced: boolean;
  }> = [];

  for (const founder of FOUNDERS) {
    const category = await prisma.category.findUnique({
      where: { slug: founder.categorySlug },
    });
    if (!category) throw new Error(`Category ${founder.categorySlug} missing`);

    const seasonCategory = await prisma.seasonCategory.findUnique({
      where: {
        seasonId_categoryId: {
          seasonId: season.id,
          categoryId: category.id,
        },
      },
    });
    if (!seasonCategory) {
      throw new Error(`Season category missing for ${founder.categorySlug}`);
    }

    const arenaId = await ensureArena(seasonCategory.id, scope.id);

    const brand = await prisma.brand.upsert({
      where: { slug: founder.slug },
      update: {
        name: founder.name,
        websiteUrl: founder.websiteUrl,
        normalizedName: normalizeBrandName(founder.name),
        primaryCategoryId: category.id,
        ownerUserId: owner.id,
        verificationStatus: "VERIFIED",
        isActive: true,
        source: "founder",
      },
      create: {
        slug: founder.slug,
        name: founder.name,
        normalizedName: normalizeBrandName(founder.name),
        websiteUrl: founder.websiteUrl,
        primaryCategoryId: category.id,
        ownerUserId: owner.id,
        verificationStatus: "VERIFIED",
        isActive: true,
        source: "founder",
      },
    });

    const existingCell = await prisma.cell.findFirst({
      where: {
        arenaId,
        ownerBrandId: brand.id,
        state: { in: ["HELD", "FADING", "CONTESTED"] },
      },
      select: { id: true },
    });

    let cellId = existingCell?.id ?? null;
    let alreadyPlaced = Boolean(existingCell);

    if (!existingCell) {
      // A normal early ring: expensive enough to look intentional, still
      // within a 5 000 ₸ placement.
      const freeCell = await prisma.cell.findFirst({
        where: {
          arenaId,
          state: "NEUTRAL",
          ownerBrandId: null,
          layer: { in: ["CORE", "FRONTIER"] },
          priceKzt: { lte: founder.amountKzt },
        },
        orderBy: [{ ring: "asc" }, { priceKzt: "desc" }, { q: "asc" }, { r: "asc" }],
      });
      if (!freeCell) throw new Error(`No free cell in ${founder.categorySlug}`);

      const claimed = await claimCell({
        arenaId,
        q: freeCell.q,
        r: freeCell.r,
        brandId: brand.id,
        userId: owner.id,
        amountKzt: founder.amountKzt,
      });
      if (!claimed.ok) {
        throw new Error(`Claim failed for ${founder.slug}: ${claimed.reason}`);
      }
      cellId = claimed.cellId;
    }

    const existingTx = await prisma.transaction.findFirst({
      where: {
        brandId: brand.id,
        type: { in: ["BRAND_ENTRY", "CELL_CLAIM"] },
        status: "COMPLETED",
        amountKzt: founder.amountKzt,
      },
    });

    if (!existingTx) {
      await prisma.transaction.create({
        data: {
          userId: owner.id,
          brandId: brand.id,
          seasonCategoryId: seasonCategory.id,
          type: "CELL_CLAIM",
          amountKzt: founder.amountKzt,
          status: "COMPLETED",
          paymentProvider: "founder",
        },
      });
    }

    await prisma.territory.upsert({
      where: {
        seasonCategoryId_brandId: {
          seasonCategoryId: seasonCategory.id,
          brandId: brand.id,
        },
      },
      update: {
        battlePower: founder.amountKzt,
        cellCount: 1,
      },
      create: {
        seasonCategoryId: seasonCategory.id,
        brandId: brand.id,
        battlePower: founder.amountKzt,
        cellCount: 1,
        territoryShare: 1,
        rank: 1,
        visualLevel: 5,
        capitalLevel: 5,
      },
    });

    await recalculateCategory(seasonCategory.id);

    results.push({
      slug: founder.slug,
      categorySlug: founder.categorySlug,
      brandId: brand.id,
      cellId,
      amountKzt: founder.amountKzt,
      alreadyPlaced,
    });
  }

  return { ok: true as const, results };
}
