import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { PlanetMap } from "@/components/PlanetMap";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  let brandCount = 0;
  let categoryCount = 6;
  let leaders: Array<{ name: string; slug: string; category: string }> = [];

  try {
    [brandCount, categoryCount] = await Promise.all([
      prisma.brand.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: true } }),
    ]);

    const top = await prisma.territory.findMany({
      where: { rank: 1 },
      take: 3,
      include: {
        brand: { select: { name: true, slug: true } },
        seasonCategory: { include: { category: true } },
      },
    });
    leaders = top.map((row) => ({
      name: row.brand.name,
      slug: row.brand.slug,
      category:
        locale === "kk"
          ? row.seasonCategory.category.nameKk
          : row.seasonCategory.category.nameRu,
    }));
  } catch {
    // DB optional at build
  }

  return (
    <div className="space-y-16">
      <section className="surface-card overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="flex flex-col justify-center p-8 md:p-12">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-4 max-w-md text-lg text-muted">{t("subtitle")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/claim-brand" className="btn-primary text-center">
                {t("ctaClaimFull")}
              </Link>
              <Link href="/map" className="btn-secondary text-center">
                {t("ctaMap")}
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">{t("legalNote")}</p>
          </div>
          <div className="min-h-[320px] border-t border-[var(--color-border)] lg:border-l lg:border-t-0">
            <PlanetMap locale={locale} height={360} compact />
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <StatCard label={t("statsBrands")} value={brandCount} />
        <StatCard label={t("statsCategories")} value={categoryCount} />
      </section>

      <section className="surface-card">
        <h2 className="font-display text-2xl font-semibold text-ink">{t("howTitle")}</h2>
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
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 border-t border-[var(--color-border)] pt-6">
          <Link href="/claim-brand" className="btn-primary">
            {t("ctaClaimFull")}
          </Link>
        </div>
      </section>

      {leaders.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold text-ink">{t("leadersTitle")}</h2>
          <ul className="mt-4 space-y-2">
            {leaders.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/brand/${l.slug}`}
                  className="flex items-center justify-between rounded-brand bg-[var(--color-surface-soft)] px-4 py-3 hover:bg-white"
                >
                  <span className="font-medium text-ink">{l.name}</span>
                  <span className="text-sm text-muted">{l.category}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="surface-card text-center">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold text-primary">{value}</p>
    </div>
  );
}
