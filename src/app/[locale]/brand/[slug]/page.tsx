import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getRankLabel } from "@/lib/territory";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function BrandPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  let brand: Awaited<ReturnType<typeof loadBrand>> = null;
  try {
    brand = await loadBrand(slug);
  } catch {
    // DB unavailable
  }

  if (!brand) notFound();

  const territory = brand.territories[0];
  const categoryName =
    locale === "kk"
      ? brand.primaryCategory.nameKk
      : brand.primaryCategory.nameRu;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Реклама · BrandWars.kz
          </p>
          <h1 className="text-3xl font-bold">{brand.name}</h1>
          <p className="text-slate-400">{categoryName}</p>
          {brand.verificationStatus === "VERIFIED" && (
            <span className="mt-2 inline-block rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-400">
              Проверенный бренд
            </span>
          )}
        </div>
        {brand.websiteUrl && (
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
          >
            Перейти на сайт
          </a>
        )}
      </div>

      {territory && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Место" value={`#${territory.rank}`} />
          <Metric
            label="Территория"
            value={`${Math.round(territory.territoryShare * 100)}%`}
          />
          <Metric
            label="Статус"
            value={getRankLabel(territory.rank, locale)}
          />
        </div>
      )}

      <p className="text-sm text-slate-500">
        Рейтинг отражает игровую метрику BrandWars в текущем сезоне, а не
        качество товаров или услуг. Формулировка: «лидер BrandWars в категории».
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/category/${brand.primaryCategory.slug}`}
          className="rounded border border-slate-600 px-4 py-2 text-sm hover:border-sky-600"
        >
          Карта категории
        </Link>
        <Link
          href="/verify"
          className="rounded border border-slate-600 px-4 py-2 text-sm hover:border-sky-600"
        >
          Верификация
        </Link>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/share-cards/${brand.slug}`}
        alt="Share card preview"
        className="hidden"
      />
    </div>
  );
}

async function loadBrand(slug: string) {
  return prisma.brand.findUnique({
    where: { slug },
    include: {
      primaryCategory: true,
      territories: { orderBy: { rank: "asc" }, take: 1 },
    },
  });
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-sky-400">{value}</p>
    </div>
  );
}
