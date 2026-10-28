import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { QuickClaimForm } from "@/components/QuickClaimForm";
import { ENTRY_PRICE_KZT } from "@/lib/category-catalog";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; amount?: string }>;
};

/**
 * The buy page is the short path, prefilled from whichever "take this place
 * for X" button brought the visitor here. The detailed wizard stays reachable
 * for anyone who wants to fill everything in up front, but it is no longer the
 * default — the default is three fields and a payment.
 */
export default async function ClaimBrandPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { category, amount } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("claim");

  const parsedAmount = Number(amount);
  const initialAmountKzt =
    Number.isFinite(parsedAmount) && parsedAmount >= ENTRY_PRICE_KZT
      ? Math.round(parsedAmount)
      : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("step1hint")}</p>
      </div>

      <QuickClaimForm
        locale={locale}
        initialCategory={category}
        initialAmountKzt={initialAmountKzt}
      />

      <p className="text-sm text-muted">
        Нужно указать всё сразу — представителя, город, персонажа?{" "}
        <Link
          href="/claim-brand/detailed"
          className="font-medium text-[var(--color-primary)] hover:underline"
        >
          Подробная форма
        </Link>
      </p>
    </div>
  );
}
