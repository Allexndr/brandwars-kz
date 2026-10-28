import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { CellArenaMap } from "@/components/CellArenaMap";
import { prisma } from "@/lib/prisma";
import { syncCategoryCatalog } from "@/lib/category-sync";

type Props = {
  params: Promise<{ locale: string; slug: string; scope: string }>;
};

async function loadPage(slug: string, scopeSlug: string) {
  await syncCategoryCatalog();
  return Promise.all([
    prisma.category.findUnique({
      where: { slug },
      select: {
        slug: true,
        nameRu: true,
        nameKk: true,
        continentRu: true,
        continentKk: true,
      },
    }),
    prisma.scope.findUnique({
      where: { slug: scopeSlug },
      select: {
        slug: true,
        kind: true,
        nameRu: true,
        nameKk: true,
        isOpen: true,
        parent: { select: { slug: true } },
      },
    }),
  ]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, scope } = await params;
  const [category, location] = await loadPage(slug, scope);
  if (!category || !location?.isOpen) return { robots: { index: false, follow: false } };

  const categoryName = locale === "kk" ? category.nameKk : category.nameRu;
  const locationName = locale === "kk" ? location.nameKk : location.nameRu;
  return {
    title: `${categoryName} в ${locationName} - BrandWars.kz`,
    description: `Живая карта брендов категории «${categoryName}» в городе ${locationName}: клетки, рейтинг и открытые окна внимания.`,
    robots: { index: true, follow: true },
  };
}

export default async function ScopedCategoryPage({ params }: Props) {
  const { locale, slug, scope } = await params;
  setRequestLocale(locale);

  const [category, location] = await loadPage(slug, scope);
  if (
    !category ||
    !location ||
    !location.isOpen ||
    location.kind === "WORLD" ||
    (location.kind === "CITY" && location.parent?.slug !== "kz")
  ) {
    notFound();
  }

  const categoryName = locale === "kk" ? category.nameKk : category.nameRu;
  const continentName = locale === "kk" ? category.continentKk : category.continentRu;
  const locationName = locale === "kk" ? location.nameKk : location.nameRu;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            {continentName} · {locationName}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
            {categoryName} в {locationName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Локальная живая сетка открывается только там, где уже есть достаточно
            реальных брендов. Рейтинг города не смешивается с рейтингом страны.
          </p>
        </div>
        <Link href={`/category/${slug}`} className="btn-secondary px-4 py-2 text-sm">
          Рейтинг Казахстана
        </Link>
      </div>

      <CellArenaMap categorySlug={slug} locale={locale} scope={scope} />
    </div>
  );
}
