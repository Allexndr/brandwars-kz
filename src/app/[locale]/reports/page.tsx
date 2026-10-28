import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buildPlatformReport, reportDate } from "@/lib/report-data";
import { syncCategoryCatalog } from "@/lib/category-sync";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

/**
 * The flagship indexable page: live prices and occupancy across every
 * continent, rebuilt on every request.
 *
 * Built for citation as much as for ranking — a dated, sourced, tabular answer
 * to "what does it cost to advertise a brand in Kazakhstan right now" is
 * exactly the shape of content answer engines quote, and the freshness is real
 * rather than a stamped date.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const today = reportDate(new Date());

  return {
    title: `Сколько стоит место для бренда на карте — отчёт на ${today}`,
    description: `Живые цены входа, занятость земли и лидеры по ${24} материкам BrandWars на ${today}. Данные обновляются автоматически.`,
    alternates: { canonical: `/${locale}/reports` },
    openGraph: {
      title: `Отчёт по материкам BrandWars — ${today}`,
      description:
        "Цены входа, занятость, лидеры и переходы по каждому материку. Обновляется автоматически.",
      type: "article",
    },
  };
}

export default async function ReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  await syncCategoryCatalog().catch(() => undefined);
  const report = await buildPlatformReport();
  const today = reportDate(report.generatedAt);

  const withFreeLand = report.rows.filter((row) => row.freeCells > 0);
  const cheapestTop = [...report.rows]
    .filter((row) => row.brandCount > 0)
    .sort((a, b) => a.takeFirstPlaceKzt - b.takeFirstPlaceKzt)
    .slice(0, 5);

  return (
    <article className="space-y-8">
      {/* Dataset + Article markup: the page is a dataset, and saying so is what
          makes it quotable. No AggregateRating anywhere — the ranking is a game
          metric, not a quality judgement. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: `Цены и занятость материков BrandWars на ${today}`,
            description:
              "Минимальная цена входа, стоимость первого места, занятость земли и количество переходов по каждому материку BrandWars.",
            dateModified: report.generatedAt.toISOString(),
            creator: { "@type": "Organization", name: "BrandWars.kz" },
            isAccessibleForFree: true,
            variableMeasured: [
              "Минимальная цена входа, ₸",
              "Стоимость первого места, ₸",
              "Занятость земли, %",
              "Переходы за 24 часа",
            ],
          }),
        }}
      />

      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Отчёт · обновлён {today}
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink md:text-4xl">
          Сколько стоит место для бренда на карте BrandWars
        </h1>
        {/* Direct answer first, context after — the structure answer engines
            extract from. */}
        <p className="max-w-2xl text-lg text-muted">
          На {today} вход на любой материк начинается от{" "}
          <strong className="text-ink">1 000 ₸</strong>. Свободная земля есть в{" "}
          <strong className="text-ink">{withFreeLand.length}</strong> из{" "}
          {report.totals.categories} материков, на карте{" "}
          <strong className="text-ink">{report.totals.brands}</strong> брендов, и
          за последние сутки по их ссылкам совершено{" "}
          <strong className="text-ink">{report.totals.clicksLast24h}</strong>{" "}
          переходов.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Брендов на карте" value={report.totals.brands} />
        <Stat label="Подтверждённых" value={report.totals.verifiedBrands} />
        <Stat label="Свободных клеток" value={report.totals.freeCells} />
        <Stat label="Активных окон" value={report.totals.openContests} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Цены по материкам на {today}
        </h2>
        <div className="overflow-x-auto rounded-brand border border-[var(--color-border)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[var(--color-surface-soft)] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Материк</th>
                <th className="px-4 py-3 font-medium">Брендов</th>
                <th className="px-4 py-3 font-medium">Занято</th>
                <th className="px-4 py-3 font-medium">Свободно клеток</th>
                <th className="px-4 py-3 font-medium">Вход от</th>
                <th className="px-4 py-3 font-medium">Занять #1</th>
                <th className="px-4 py-3 font-medium">Лидер</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr
                  key={row.slug}
                  className="border-t border-[var(--color-border)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/category/${row.slug}`}
                      className="font-medium text-ink hover:text-[var(--color-primary)]"
                    >
                      {row.continent}
                    </Link>
                    <span className="block text-xs text-muted">{row.name}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.brandCount}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.occupancyPercent}%
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.freeCells}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.cheapestEntryKzt.toLocaleString("ru-KZ")} ₸
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-[var(--color-primary)]">
                    {row.takeFirstPlaceKzt.toLocaleString("ru-KZ")} ₸
                  </td>
                  <td className="px-4 py-3">
                    {row.leaderSlug ? (
                      <Link
                        href={`/brand/${row.leaderSlug}`}
                        className="text-ink hover:text-[var(--color-primary)]"
                      >
                        {row.leaderName}
                      </Link>
                    ) : (
                      <span className="text-muted">свободно</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {cheapestTop.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Где первое место дешевле всего
          </h2>
          <ol className="space-y-2">
            {cheapestTop.map((row, index) => (
              <li
                key={row.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-brand bg-[var(--color-surface-soft)] px-4 py-3"
              >
                <span className="text-sm text-ink">
                  <strong>{index + 1}.</strong> {row.continent} — {row.name}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display font-semibold tabular-nums text-ink">
                    {row.takeFirstPlaceKzt.toLocaleString("ru-KZ")} ₸
                  </span>
                  <Link
                    href={`/claim-brand?category=${row.slug}&amount=${row.takeFirstPlaceKzt}`}
                    className="btn-primary px-3 py-1 text-xs"
                  >
                    Занять
                  </Link>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {withFreeLand.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Материки со свободной землёй
          </h2>
          <p className="text-sm text-muted">
            Здесь можно занять клетку сразу, без окна противостояния.
          </p>
          <div className="flex flex-wrap gap-2">
            {withFreeLand.map((row) => (
              <Link
                key={row.slug}
                href={`/claim-brand?category=${row.slug}`}
                className="rounded-brand border border-[var(--color-border)] px-3 py-2 text-sm text-ink hover:border-[var(--color-primary)]"
              >
                {row.continent}
                <span className="ml-2 text-xs text-muted">
                  {row.freeCells} свободно
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="space-y-3 border-t border-[var(--color-border)] pt-6">
        <p className="text-sm text-muted">
          Источник данных: BrandWars.kz, срез на {today}. Страница
          пересобирается при каждом обращении. Позиция бренда определяется
          оплаченной суммой и площадью занятой земли — это игровая метрика
          платформы, а не оценка качества товаров или услуг.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/claim-brand" className="btn-primary">
            Занять место на карте
          </Link>
          <Link href="/guides" className="btn-secondary">
            Как это работает
          </Link>
        </div>
      </footer>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink">
        {value.toLocaleString("ru-KZ")}
      </p>
    </div>
  );
}
