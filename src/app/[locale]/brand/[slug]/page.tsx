import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getRankLabel } from "@/lib/territory";
import { BadgeEmbed } from "@/components/BadgeEmbed";

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

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://brandwars.kz";

  return (
    <div className="space-y-6">
      {/*
        Organization, not LocalBusiness with a rating.
        Deliberately no AggregateRating: the position here is a paid game
        metric, and marking it up as a rating would assert a quality judgement
        the page does not make — exactly the mismatch between visible content
        and structured data that gets a site penalised.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: brand.name,
            ...(brand.websiteUrl ? { url: brand.websiteUrl } : {}),
            ...(brand.logoUrl ? { logo: brand.logoUrl } : {}),
            ...(brand.description ? { description: brand.description } : {}),
            identifier: `${baseUrl}/${locale}/brand/${brand.slug}`,
            subjectOf: {
              "@type": "WebPage",
              url: `${baseUrl}/${locale}/brand/${brand.slug}`,
              name: `${brand.name} — ${categoryName} на карте BrandWars`,
              dateModified: brand.updatedAt.toISOString(),
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Каталог брендов",
                item: `${baseUrl}/${locale}/brands`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: categoryName,
                item: `${baseUrl}/${locale}/category/${brand.primaryCategory.slug}`,
              },
              { "@type": "ListItem", position: 3, name: brand.name },
            ],
          }),
        }}
      />
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
          // Through the tracked redirect, not the raw link — the click count is
          // what the brand is paying for and what justifies paying again.
          <a
            href={`/api/go/${brand.slug}`}
            target="_blank"
            rel="noopener noreferrer sponsored nofollow"
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

      <BadgeEmbed brandSlug={brand.slug} baseUrl={baseUrl} />

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
