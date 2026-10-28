import { setRequestLocale, getTranslations } from "next-intl/server";
import { ClaimWizard } from "@/components/ClaimWizard";

type Props = { params: Promise<{ locale: string }> };

export default async function ClaimBrandPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("claim");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("step1hint")}</p>
      </div>
      <ClaimWizard />
    </div>
  );
}
