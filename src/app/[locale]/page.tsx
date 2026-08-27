import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";

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
  let seasonName = "—";

  try {
    [brandCount, categoryCount] = await Promise.all([
      prisma.brand.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: true } }),
    ]);
    const season = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
    });
    if (season) {
      seasonName = locale === "kk" ? season.nameKk : season.nameRu;
    }
  } catch {
    // DB may be unavailable at build/runtime
  }

  return (
    <div className="space-y-12">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
          {t("subtitle")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/map"
            className="rounded-lg bg-sky-600 px-6 py-3 font-medium hover:bg-sky-500"
          >
            {t("ctaMap")}
          </Link>
          <Link
            href="/claim-brand"
            className="rounded-lg border border-sky-600 px-6 py-3 font-medium text-sky-400 hover:bg-sky-950"
          >
            {t("ctaClaim")}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("statsBrands")} value={brandCount} />
        <StatCard label={t("statsCategories")} value={categoryCount} />
        <StatCard label={t("statsSeason")} value={seasonName} isText />
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold">Как это работает</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-400">
          <li>Бренд добавляет ссылку и выбирает категорию (материк)</li>
          <li>После модерации появляется страна на карте</li>
          <li>Сила поддержки влияет на территорию — не «лучший бренд», а лидер BrandWars</li>
          <li>Пользователи поддерживают бренды и делятся сезонными достижениями</li>
        </ol>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  isText,
}: {
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 font-bold text-sky-400 ${isText ? "text-lg" : "text-3xl"}`}>
        {value}
      </p>
    </div>
  );
}
