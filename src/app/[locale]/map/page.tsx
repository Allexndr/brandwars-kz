import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function MapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("map");

  let categories: Array<{
    slug: string;
    nameRu: string;
    nameKk: string;
    continentRu: string;
    color: string;
    brandCount: number;
  }> = [];

  try {
    const activeSeason = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
    });

    const cats = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    if (activeSeason) {
      const seasonCategories = await prisma.seasonCategory.findMany({
        where: { seasonId: activeSeason.id },
        include: { _count: { select: { territories: true } } },
      });
      const countByCategory = Object.fromEntries(
        seasonCategories.map((sc) => [sc.categoryId, sc._count.territories]),
      );
      categories = cats.map((c) => ({
        slug: c.slug,
        nameRu: c.nameRu,
        nameKk: c.nameKk,
        continentRu: c.continentRu,
        color: c.color,
        brandCount: countByCategory[c.id] ?? 0,
      }));
    } else {
      categories = cats.map((c) => ({
        slug: c.slug,
        nameRu: c.nameRu,
        nameKk: c.nameKk,
        continentRu: c.continentRu,
        color: c.color,
        brandCount: 0,
      }));
    }
  } catch {
    // fallback empty
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="surface-card group transition hover:shadow-lg"
            style={{ borderLeft: `4px solid ${cat.color}` }}
          >
            <h2 className="font-display text-lg font-semibold text-ink group-hover:text-primary">
              {locale === "kk" ? cat.nameKk : cat.nameRu}
            </h2>
            <p className="text-sm text-muted">{cat.continentRu}</p>
            <p className="mt-2 text-xs text-muted">{cat.brandCount} брендов на карте</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
