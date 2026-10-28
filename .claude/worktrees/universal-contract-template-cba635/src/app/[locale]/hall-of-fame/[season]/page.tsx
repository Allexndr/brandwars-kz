import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getRankLabel } from "@/lib/territory";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; season: string }>;
};

export default async function HallOfFamePage({ params }: Props) {
  const { locale, season: seasonSlug } = await params;
  setRequestLocale(locale);

  const season = await prisma.season.findUnique({
    where: { slug: seasonSlug },
    include: {
      seasonCategories: {
        include: {
          category: true,
          territories: {
            where: { rank: 1 },
            include: { brand: true },
          },
        },
      },
    },
  });

  if (!season) notFound();

  const winners = season.seasonCategories.flatMap((sc) =>
    sc.territories.map((t) => ({
      category: locale === "kk" ? sc.category.nameKk : sc.category.nameRu,
      brand: t.brand.name,
      slug: t.brand.slug,
      label: getRankLabel(1, locale),
    })),
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Зал славы</h1>
      <p className="text-muted">{locale === "kk" ? season.nameKk : season.nameRu}</p>
      {winners.length === 0 ? (
        <p className="text-muted">Победители сезона пока не определены</p>
      ) : (
        <ul className="space-y-3">
          {winners.map((w) => (
            <li key={`${w.category}-${w.slug}`} className="surface-card border-l-4 border-primary">
              <p className="text-sm text-primary">{w.category}</p>
              <p className="font-display text-lg font-semibold text-ink">{w.brand}</p>
              <p className="text-xs text-muted">{w.label}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
