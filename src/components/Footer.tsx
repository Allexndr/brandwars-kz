"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-slate-400">
        <div className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-slate-200">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-slate-200">
            {t("terms")}
          </Link>
          <Link href="/report" className="hover:text-slate-200">
            {t("report")}
          </Link>
          <Link href="/rules" className="hover:text-slate-200">
            Правила
          </Link>
        </div>
        <p className="max-w-2xl text-xs leading-relaxed">{t("disclaimer")}</p>
        <p className="text-xs">© {new Date().getFullYear()} BrandWars.kz · Казахстан</p>
      </div>
    </footer>
  );
}
