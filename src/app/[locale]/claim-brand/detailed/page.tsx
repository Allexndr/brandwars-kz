import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ClaimWizard } from "@/components/ClaimWizard";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
};

/**
 * The long form, kept for brands that genuinely want to set everything before
 * paying. It requires a signed-in account; the short path on /claim-brand does
 * not, and that is the one linked everywhere.
 */
export default async function DetailedClaimPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { category } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("claim");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Подробная форма со всеми настройками сразу. Требуется вход в аккаунт.
        </p>
        <p className="mt-2 text-sm text-muted">
          Быстрее —{" "}
          <Link
            href="/claim-brand"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            занять место за три поля без аккаунта
          </Link>
        </p>
      </div>
      <ClaimWizard initialCategory={category} />
    </div>
  );
}
