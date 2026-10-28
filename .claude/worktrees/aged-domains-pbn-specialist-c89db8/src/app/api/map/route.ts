import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const full = req.nextUrl.searchParams.get("full") === "1";

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
      id: string;
      rank: number;
      territoryShare: number;
      battlePower: number;
      brand: { slug: string; name: string; websiteUrl: string | null };
    }>;
  }> = [];

  if (activeSeason) {
    seasonCategories = await prisma.seasonCategory.findMany({
      where: { seasonId: activeSeason.id },
      include: {
        territories: {
          include: { brand: true },
          orderBy: { rank: "asc" },
          take: full ? 40 : 3,
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
    const territories = (sc?.territories ?? []).map((t) => ({
      id: t.id,
      slug: t.brand.slug,
      name: t.brand.name,
      rank: t.rank,
      territoryShare: t.territoryShare,
      battlePower: t.battlePower,
      color: cat.color,
      websiteUrl: t.brand.websiteUrl,
    }));

    return {
      slug: cat.slug,
      nameRu: cat.nameRu,
      nameKk: cat.nameKk,
      continentRu: cat.continentRu,
      continentKk: cat.continentKk,
      color: cat.color,
      brandCount: sc?._count.territories ?? 0,
      leaders: territories.slice(0, 3).map((t) => ({
        slug: t.slug,
        name: t.name,
        rank: t.rank,
        territoryShare: t.territoryShare,
        battlePower: t.battlePower,
      })),
      ...(full ? { territories } : {}),
    };
  });

  return NextResponse.json({
    categories: mapData,
  });
}
