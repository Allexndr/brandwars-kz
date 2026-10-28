"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-auto border-t border-[var(--color-border)] bg-[var(--color-surface-soft)] py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 text-sm text-muted">
        <div className="flex flex-wrap gap-6">
          <Link href="/privacy" className="hover:text-ink">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-ink">
            {t("terms")}
          </Link>
          <Link href="/report" className="hover:text-ink">
            {t("report")}
          </Link>
          <Link href="/rules" className="hover:text-ink">
            Правила
          </Link>
        </div>
        <p className="max-w-xl text-xs leading-relaxed">{t("disclaimer")}</p>
        <p className="text-xs">© {new Date().getFullYear()} BrandWars.kz · Казахстан</p>
      </div>
    </footer>
  );
}
