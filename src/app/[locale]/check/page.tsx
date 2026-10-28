import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { BrandCheck } from "@/components/BrandCheck";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Проверить бренд: кто занимает вашу категорию и сколько это стоит",
    description:
      "Бесплатно и без регистрации: вставьте ссылку на бренд и узнайте, кто лидирует в вашей категории, сколько он вложил, сколько получил переходов и что нужно, чтобы занять первое место.",
    alternates: { canonical: `/${locale}/check` },
  };
}

/**
 * The free-tool landing page.
 *
 * One input, no signup, a real answer — that is the whole design. The report is
 * built from figures the platform holds, which is also what makes it worth
 * sharing: nobody else can tell a brand what the leader in its category
 * actually paid.
 */
export default async function CheckPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Бесплатно · без регистрации
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink md:text-4xl">
          Кто занимает вашу категорию?
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Вставьте ссылку на свой сайт или соцсеть — покажем лидера вашей
          категории, сколько он вложил, сколько переходов получил и во сколько
          обойдётся первое место.
        </p>
      </header>

      <BrandCheck locale={locale} />

      <section className="surface-card space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">
          Что вы узнаете
        </h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>· есть ли ваш бренд на карте и на каком он месте</li>
          <li>· кто лидер вашей категории и сколько он заплатил</li>
          <li>· сколько переходов по ссылке получают участники</li>
          <li>· сколько стоит перехода в вашей категории</li>
          <li>· свободна ли земля и можно ли зайти прямо сейчас</li>
          <li>· во сколько обойдётся первое место</li>
        </ul>
        <p className="text-xs text-muted">
          Все числа — из реальных данных платформы, без прогнозов и оценок.
        </p>
      </section>

      <footer className="flex flex-wrap gap-3">
        <Link href="/reports" className="btn-secondary">
          Отчёт по всем материкам
        </Link>
        <Link href="/guides" className="btn-secondary">
          Как это работает
        </Link>
      </footer>
    </div>
  );
}
