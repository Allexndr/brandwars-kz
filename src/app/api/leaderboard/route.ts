import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankLabel } from "@/lib/territory";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const categorySlug = searchParams.get("category");
  const period = searchParams.get("period") ?? "season";
  const locale = searchParams.get("locale") ?? "ru";

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeSeason) {
    return NextResponse.json({ entries: [], period });
  }

  const seasonCategories = await prisma.seasonCategory.findMany({
    where: {
      seasonId: activeSeason.id,
      ...(categorySlug
        ? { category: { slug: categorySlug } }
        : {}),
    },
    include: {
      category: true,
      territories: {
        include: { brand: true },
        orderBy: { rank: "asc" },
      },
    },
  });

  const entries = seasonCategories.flatMap((sc) =>
    sc.territories.map((t) => ({
      brandSlug: t.brand.slug,
      brandName: t.brand.name,
      categorySlug: sc.category.slug,
      categoryName: locale === "kk" ? sc.category.nameKk : sc.category.nameRu,
      rank: t.rank,
      rankLabel: getRankLabel(t.rank, locale),
      battlePower: t.battlePower,
      territoryShare: t.territoryShare,
      period,
      verificationStatus: t.brand.verificationStatus,
    })),
  );

  if (period === "community") {
    entries.sort((a, b) => b.battlePower - a.battlePower);
  } else {
    entries.sort((a, b) => a.rank - b.rank);
  }

  return NextResponse.json({
    season: activeSeason.slug,
    period,
    entries: entries.slice(0, 50),
  });
}
