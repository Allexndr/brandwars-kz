import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankLabel } from "@/lib/territory";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const locale = request.nextUrl.searchParams.get("locale") ?? "ru";

  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeSeason) {
    return NextResponse.json({ error: "No active season" }, { status: 404 });
  }

  const seasonCategory = await prisma.seasonCategory.findUnique({
    where: {
      seasonId_categoryId: {
        seasonId: activeSeason.id,
        categoryId: category.id,
      },
    },
    include: {
      territories: {
        include: { brand: true },
        orderBy: { rank: "asc" },
      },
    },
  });

  if (!seasonCategory) {
    return NextResponse.json({ error: "Season category not found" }, { status: 404 });
  }

  const territories = seasonCategory.territories.map((t, index) => ({
    id: t.id,
    brandId: t.brandId,
    slug: t.brand.slug,
    name: t.brand.name,
    websiteUrl: t.brand.websiteUrl,
    logoUrl: t.brand.logoUrl,
    verificationStatus: t.brand.verificationStatus,
    battlePower: t.battlePower,
    territoryShare: t.territoryShare,
    rank: t.rank,
    visualLevel: t.visualLevel,
    capitalLevel: t.capitalLevel,
    rankLabel: getRankLabel(t.rank, locale),
    gridIndex: index,
    color: category.color,
  }));

  return NextResponse.json({
    category: {
      slug: category.slug,
      nameRu: category.nameRu,
      nameKk: category.nameKk,
      continentRu: category.continentRu,
      continentKk: category.continentKk,
      color: category.color,
    },
    season: {
      slug: activeSeason.slug,
      nameRu: activeSeason.nameRu,
      nameKk: activeSeason.nameKk,
      endsAt: activeSeason.endsAt,
    },
    seasonCategory: {
      entryMinimumKzt: seasonCategory.entryMinimumKzt,
      priceCoefficient: seasonCategory.priceCoefficient,
    },
    territories,
  });
}
