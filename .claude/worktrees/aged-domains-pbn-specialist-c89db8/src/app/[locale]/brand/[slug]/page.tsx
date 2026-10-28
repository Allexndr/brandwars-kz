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
    locale === "kk" ? brand.primaryCategory.nameKk : brand.primaryCategory.nameRu;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Реклама · BrandWars.kz</p>
          <h1 className="font-display text-3xl font-semibold text-ink">{brand.name}</h1>
          <p className="text-muted">{categoryName}</p>
          {brand.verificationStatus === "VERIFIED" && (
            <span className="mt-2 inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
              Проверенный бренд
            </span>
          )}
        </div>
        {brand.websiteUrl && (
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="btn-primary text-sm"
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
          <Metric label="Статус" value={getRankLabel(territory.rank, locale)} />
        </div>
      )}

      <p className="text-sm text-muted">
        Рейтинг отражает игровую метрику BrandWars в текущем сезоне, а не качество товаров или
        услуг. Формулировка: «лидер BrandWars в категории».
      </p>

      <div className="flex flex-wrap gap-3">
        <Link href={`/category/${brand.primaryCategory.slug}`} className="btn-secondary text-sm">
          Карта категории
        </Link>
        <Link href="/verify" className="btn-secondary text-sm">
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
    <div className="surface-card">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold text-primary">{value}</p>
    </div>
  );
}
