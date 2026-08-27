import { setRequestLocale, getTranslations } from "next-intl/server";
import { PlanetMap } from "@/components/PlanetMap";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function MapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("map");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("subtitle")}</p>
      </div>
      <PlanetMap locale={locale} height={680} />
    </div>
  );
}
