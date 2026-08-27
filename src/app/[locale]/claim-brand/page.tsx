import { setRequestLocale, getTranslations } from "next-intl/server";
import { ClaimWizard } from "@/components/ClaimWizard";

type Props = { params: Promise<{ locale: string }> };

export default async function ClaimBrandPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("claim");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Заявка создаёт игровую карточку бренда на карте BrandWars — не заявление
          о «лучшем бренде».
        </p>
      </div>
      <ClaimWizard />
    </div>
  );
}
