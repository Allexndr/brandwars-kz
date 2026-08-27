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
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-slate-400">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="group rounded-xl border border-slate-800 p-5 transition hover:border-sky-700"
            style={{ borderLeftColor: cat.color, borderLeftWidth: 4 }}
          >
            <h2 className="text-lg font-semibold group-hover:text-sky-300">
              {locale === "kk" ? cat.nameKk : cat.nameRu}
            </h2>
            <p className="text-sm text-slate-400">{cat.continentRu}</p>
            <p className="mt-2 text-xs text-slate-500">
              {cat.brandCount} брендов на карте
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
