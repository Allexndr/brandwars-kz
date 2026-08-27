import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
  });

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  let seasonCategories: Array<{
    categoryId: string;
    _count: { territories: number };
    territories: Array<{
      rank: number;
      territoryShare: number;
      battlePower: number;
      brand: { slug: string; name: string };
    }>;
  }> = [];

  if (activeSeason) {
    seasonCategories = await prisma.seasonCategory.findMany({
      where: { seasonId: activeSeason.id },
      include: {
        territories: {
          include: { brand: true },
          orderBy: { rank: "asc" },
          take: 3,
        },
        _count: { select: { territories: true } },
      },
    });
  }

  const scByCategory = Object.fromEntries(
    seasonCategories.map((sc) => [sc.categoryId, sc]),
  );

  const mapData = categories.map((cat) => {
    const sc = scByCategory[cat.id];
    return {
      slug: cat.slug,
      nameRu: cat.nameRu,
      nameKk: cat.nameKk,
      continentRu: cat.continentRu,
      continentKk: cat.continentKk,
      color: cat.color,
      brandCount: sc?._count.territories ?? 0,
      leaders: (sc?.territories ?? []).map((t) => ({
        slug: t.brand.slug,
        name: t.brand.name,
        rank: t.rank,
        territoryShare: t.territoryShare,
        battlePower: t.battlePower,
      })),
    };
  });

  return NextResponse.json({
    season: activeSeason,
    categories: mapData,
  });
}
