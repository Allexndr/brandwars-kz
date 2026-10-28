import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { PlanetMap } from "@/components/PlanetMap";
import { QuickClaimForm } from "@/components/QuickClaimForm";
import { LiveStats } from "@/components/LiveStats";
import { BrandLeaderboard } from "@/components/BrandLeaderboard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ContestCountdown } from "@/components/ContestCountdown";
import { BrandCheck } from "@/components/BrandCheck";
import { syncCategoryCatalog } from "@/lib/category-sync";
import { ENTRY_PRICE_KZT, TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  let categoryCount = 24;
  let topPlaceKzt: number | null = null;

  try {
    await syncCategoryCatalog();
    categoryCount = await prisma.category.count({ where: { isActive: true } });

    // What it costs to take #1 right now — the headline number, same as the
    // reference product. Derived from real spend, not a guess.
    const top = await prisma.transaction.groupBy({
      by: ["brandId"],
      where: {
        status: "COMPLETED",
        type: {
          in: ["BRAND_ENTRY", "TOP_UP", "CELL_CLAIM", "CELL_UPKEEP", "CONTEST_BID"],
        },
        brandId: { not: null },
      },
      _sum: { amountKzt: true },
      orderBy: { _sum: { amountKzt: "desc" } },
      take: 1,
    });

    const leaderSpend = top[0]?._sum.amountKzt ?? 0;
    topPlaceKzt =
      leaderSpend > 0
        ? Math.ceil((leaderSpend + 1) / TERRITORY_CELL_PRICE_KZT) *
          TERRITORY_CELL_PRICE_KZT
        : ENTRY_PRICE_KZT;
  } catch {
    // DB optional at build time.
  }

  return (
    <div className="space-y-12">
      {/* Everything needed to buy is above the fold: the price to beat, the
          live counters, and the three-field form. */}
      <section className="space-y-5">
        <LiveStats />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-4 max-w-md text-lg text-muted">{t("subtitle")}</p>

            {topPlaceKzt !== null && (
              <p className="mt-6 rounded-brand bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-ink">
                Занять #1 сейчас —{" "}
                <strong className="font-display text-lg font-semibold tabular-nums text-[var(--color-primary)]">
                  {topPlaceKzt.toLocaleString("ru-KZ")} ₸
                </strong>
                <span className="mt-1 block text-xs text-muted">
                  Вход от {ENTRY_PRICE_KZT.toLocaleString("ru-KZ")} ₸ ·{" "}
                  {categoryCount} материков
                </span>
              </p>
            )}
          </div>

          <QuickClaimForm locale={locale} topPlaceKzt={topPlaceKzt} />
        </div>
      </section>

      <section>
        <PlanetMap locale={locale} height={520} />
      </section>

      <ContestCountdown />

      {/* Free, no-signup report: the fastest route to "this is worth money". */}
      <BrandCheck locale={locale} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <BrandLeaderboard locale={locale} />
        <div className="space-y-6 lg:sticky lg:top-6">
          <ActivityFeed locale={locale} />
        </div>
      </div>

      <section className="surface-card">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {t("howTitle")}
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            { n: "1", title: t("how1title"), body: t("how1body") },
            { n: "2", title: t("how2title"), body: t("how2body") },
            { n: "3", title: t("how3title"), body: t("how3body") },
          ].map((item) => (
            <li key={item.n} className="flex gap-4">
              <span className="step-dot step-dot-active shrink-0">{item.n}</span>
              <div>
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-6">
          <Link href="/map" className="btn-secondary">
            {t("ctaMap")}
          </Link>
          <Link href="/rules" className="btn-secondary">
            Правила
          </Link>
        </div>
      </section>

      <p className="text-xs text-muted">{t("legalNote")}</p>
    </div>
  );
}
