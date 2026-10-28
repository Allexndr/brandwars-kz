import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/moderation" className="surface-card transition hover:shadow-lg">
          <h2 className="font-semibold text-primary">{t("moderation")}</h2>
          <p className="mt-1 text-sm text-muted">Заявки на добавление брендов</p>
        </Link>
      </div>
    </div>
  );
}
