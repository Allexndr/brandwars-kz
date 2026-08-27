import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CategoryMap } from "@/components/CategoryMap";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { prisma } from "@/lib/prisma";
import { getRankLabel } from "@/lib/territory";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function CategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) notFound();

  let entries: Array<{
    brandSlug: string;
    brandName: string;
    categorySlug: string;
    categoryName: string;
    rank: number;
    rankLabel: string;
    battlePower: number;
    territoryShare: number;
  }> = [];

  try {
    const activeSeason = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
    });
    if (activeSeason) {
      const sc = await prisma.seasonCategory.findUnique({
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
      entries =
        sc?.territories.map((t) => ({
          brandSlug: t.brand.slug,
          brandName: t.brand.name,
          categorySlug: slug,
          categoryName: locale === "kk" ? category.nameKk : category.nameRu,
          rank: t.rank,
          rankLabel: getRankLabel(t.rank, locale),
          battlePower: t.battlePower,
          territoryShare: t.territoryShare,
        })) ?? [];
    }
  } catch {
    // DB unavailable
  }

  return (
    <div className="space-y-8">
      <CategoryMap categorySlug={slug} locale={locale} />
      <section>
        <h2 className="mb-4 text-xl font-semibold">Рейтинг категории</h2>
        <LeaderboardTable entries={entries} locale={locale} />
      </section>
    </div>
  );
}
