import { PrismaClient } from "@prisma/client";
import { slugify, normalizeBrandName } from "../src/lib/utils";
import {
  CATEGORY_CATALOG,
  ENTRY_PRICE_KZT,
  TERRITORY_CELL_PRICE_KZT,
} from "../src/lib/category-catalog";

const prisma = new PrismaClient();

const CATEGORIES = CATEGORY_CATALOG.map((category) => ({
  ...category,
  entryMinimumKzt: ENTRY_PRICE_KZT,
  priceCoefficient: TERRITORY_CELL_PRICE_KZT,
}));

const DEMO_BRANDS = [
  {
    slug: "kaztravel-demo",
    name: "KazTravel Demo",
    websiteUrl: "https://example.com/kaztravel",
    spendKzt: 9000,
    rank: 1,
  },
  {
    slug: "astana-tours-demo",
    name: "Astana Tours Demo",
    websiteUrl: "https://example.com/astana-tours",
    spendKzt: 4000,
    rank: 2,
  },
  {
    slug: "steppe-adventures-demo",
    name: "Steppe Adventures Demo",
    websiteUrl: "https://example.com/steppe",
    spendKzt: 1000,
    rank: 3,
  },
];

async function main() {
  console.log("Seeding BrandWars.kz...");

  for (const [index, cat] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        nameRu: cat.nameRu,
        nameKk: cat.nameKk,
        continentRu: cat.continentRu,
        continentKk: cat.continentKk,
        color: cat.color,
        sortOrder: index,
      },
      create: {
        slug: cat.slug,
        nameRu: cat.nameRu,
        nameKk: cat.nameKk,
        continentRu: cat.continentRu,
        continentKk: cat.continentKk,
        color: cat.color,
        sortOrder: index,
      },
    });
  }

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + 30);

  const season = await prisma.season.upsert({
    where: { slug: "season-1" },
    update: {
      status: "ACTIVE",
      startsAt: now,
      endsAt,
    },
    create: {
      slug: "season-1",
      nameRu: "Сезон 1 — Travelia Clash",
      nameKk: "1-м seasons — Travelia Clash",
      status: "ACTIVE",
      startsAt: now,
      endsAt,
    },
  });

  const categories = await prisma.category.findMany();
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  for (const cat of CATEGORIES) {
    const categoryId = categoryMap[cat.slug];
    if (!categoryId) continue;

    await prisma.seasonCategory.upsert({
      where: {
        seasonId_categoryId: { seasonId: season.id, categoryId },
      },
      update: {
        entryMinimumKzt: cat.entryMinimumKzt,
        priceCoefficient: cat.priceCoefficient,
        status: "ACTIVE",
      },
      create: {
        seasonId: season.id,
        categoryId,
        entryMinimumKzt: cat.entryMinimumKzt,
        priceCoefficient: cat.priceCoefficient,
        status: "ACTIVE",
      },
    });
  }

  const travelCategoryId = categoryMap["travel"];
  const travelSeasonCategory = await prisma.seasonCategory.findFirst({
    where: { seasonId: season.id, categoryId: travelCategoryId },
  });

  if (!travelSeasonCategory) {
    throw new Error("Travel season category not found");
  }

  const admin = await prisma.user.upsert({
    where: { email: "admin@brandwars.kz" },
    update: { role: "ADMIN", name: "Admin" },
    create: {
      email: "admin@brandwars.kz",
      name: "Admin",
      role: "ADMIN",
      profile: { create: { locale: "ru" } },
      wallet: { create: { balance: 0 } },
    },
  });

  for (const demo of DEMO_BRANDS) {
    const brand = await prisma.brand.upsert({
      where: { slug: demo.slug },
      update: {
        name: demo.name,
        websiteUrl: demo.websiteUrl,
        verificationStatus: "VERIFIED",
        isActive: true,
      },
      create: {
        slug: demo.slug,
        name: demo.name,
        normalizedName: normalizeBrandName(demo.name),
        websiteUrl: demo.websiteUrl,
        verificationStatus: "VERIFIED",
        primaryCategoryId: travelCategoryId,
        isActive: true,
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId: admin.id,
          brandId: brand.id,
          seasonCategoryId: travelSeasonCategory.id,
          type: "BRAND_ENTRY",
          amountKzt: demo.spendKzt,
          status: "COMPLETED",
          paymentProvider: "test",
        },
      ],
      skipDuplicates: true,
    });

    await prisma.territory.upsert({
      where: {
        seasonCategoryId_brandId: {
          seasonCategoryId: travelSeasonCategory.id,
          brandId: brand.id,
        },
      },
      update: {},
      create: {
        seasonCategoryId: travelSeasonCategory.id,
        brandId: brand.id,
        battlePower: demo.spendKzt,
        territoryShare: 0,
        rank: demo.rank,
        visualLevel: demo.rank === 1 ? 5 : demo.rank <= 3 ? 4 : 1,
        capitalLevel: demo.rank === 1 ? 5 : demo.rank <= 3 ? 4 : 1,
      },
    });
  }

  const { computeTerritoryShares } = await import("../src/lib/territory");

  const territories = await prisma.territory.findMany({
    where: { seasonCategoryId: travelSeasonCategory.id },
    select: { brandId: true, battlePower: true },
  });

  const shares = computeTerritoryShares(
    territories.map((t) => ({ brandId: t.brandId, battlePower: t.battlePower })),
  );

  for (const [brandId, share] of shares.entries()) {
    await prisma.territory.updateMany({
      where: { seasonCategoryId: travelSeasonCategory.id, brandId },
      data: { territoryShare: share },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
