"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

export function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { data: session } = useSession();

  const otherLocale = locale === "ru" ? "kk" : "ru";

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-bold text-sky-400 hover:text-sky-300">
          BrandWars.kz
        </Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          <Link href="/map" className="text-slate-300 hover:text-white">
            {t("map")}
          </Link>
          <Link href="/brands" className="text-slate-300 hover:text-white">
            {t("brands")}
          </Link>
          <Link href="/claim-brand" className="text-slate-300 hover:text-white">
            {t("claim")}
          </Link>
          <Link href="/rules" className="text-slate-300 hover:text-white">
            {t("rules")}
          </Link>
          {session?.user && (
            <Link href="/dashboard" className="text-slate-300 hover:text-white">
              {t("dashboard")}
            </Link>
          )}
          {(session?.user?.role === "ADMIN" ||
            session?.user?.role === "MODERATOR") && (
            <Link href="/admin" className="text-amber-400 hover:text-amber-300">
              {t("admin")}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            locale={otherLocale}
            className="rounded border border-slate-700 px-2 py-1 text-xs uppercase text-slate-400 hover:border-sky-600"
          >
            {otherLocale}
          </Link>
          {session?.user ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
            >
              {t("logout")}
            </button>
          ) : (
            <Link
              href="/login"
              className={cn(
                "rounded bg-sky-600 px-3 py-1.5 text-sm font-medium hover:bg-sky-500",
              )}
            >
              {t("login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
