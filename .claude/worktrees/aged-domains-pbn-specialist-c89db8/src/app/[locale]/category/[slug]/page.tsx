import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { BorderClashWidget } from "@/components/BorderClashWidget";
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
    brandId: string;
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
          brandId: t.brand.id,
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Материк · {locale === "kk" ? category.nameKk : category.nameRu}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
            {locale === "kk" ? category.continentKk : category.continentRu}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Сейчас за линию внимания борются №1 и №2 по силе поддержки.
            Ресурсы движутся автоматически, а граница меняется после подтверждённой оплаты.
          </p>
        </div>
        <Link href="/map" className="btn-secondary px-4 py-2 text-sm">
          Вся планета
        </Link>
      </div>

      <BorderClashWidget
        categorySlug={slug}
        categoryName={locale === "kk" ? category.nameKk : category.nameRu}
        entries={entries}
        locale={locale}
      />

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">Рейтинг категории</h2>
        <LeaderboardTable entries={entries} locale={locale} />
      </section>
    </div>
  );
}
