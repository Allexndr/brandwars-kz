"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { signOut, useSession } from "next-auth/react";

export function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { data: session } = useSession();
  const otherLocale = locale === "ru" ? "kk" : "ru";

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-display text-lg font-semibold text-ink">
          BrandWars<span className="text-primary">.kz</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/map" className="text-muted hover:text-ink">
            {t("map")}
          </Link>
          <Link href="/brands" className="text-muted hover:text-ink">
            {t("brands")}
          </Link>
          <Link href="/rules" className="text-muted hover:text-ink">
            {t("rules")}
          </Link>
          {session?.user && (
            <Link href="/dashboard" className="text-muted hover:text-ink">
              {t("dashboard")}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            locale={otherLocale}
            className="rounded-brand border border-[var(--color-border)] px-2 py-1 text-xs font-semibold uppercase text-muted hover:text-ink"
          >
            {otherLocale}
          </Link>
          <Link href="/claim-brand" className="btn-primary hidden px-4 py-2 text-sm sm:inline-flex">
            {t("claim")}
          </Link>
          {session?.user ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="btn-secondary px-3 py-2 text-sm"
            >
              {t("logout")}
            </button>
          ) : (
            <Link href="/login" className="btn-secondary px-3 py-2 text-sm">
              {t("login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
