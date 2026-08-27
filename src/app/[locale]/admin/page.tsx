import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/moderation"
          className="rounded-xl border border-slate-800 p-6 hover:border-amber-600"
        >
          <h2 className="font-semibold text-amber-400">{t("moderation")}</h2>
          <p className="mt-1 text-sm text-slate-400">
            Заявки на добавление брендов
          </p>
        </Link>
      </div>
    </div>
  );
}
