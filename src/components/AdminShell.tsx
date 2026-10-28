"use client";

import { Link, usePathname } from "@/i18n/routing";

const NAV: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/admin", label: "Дашборд", exact: true },
  { href: "/admin/payments", label: "Платежи" },
  { href: "/admin/brands", label: "Бренды" },
  { href: "/admin/companies", label: "Клиенты" },
  { href: "/admin/users", label: "Роли" },
  { href: "/admin/withdrawals", label: "Выводы" },
  { href: "/admin/moderation", label: "Модерация" },
  { href: "/admin/social", label: "Соцпосты" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">BrandWars</p>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Супер-админ
          </h1>
        </div>
        <nav className="flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-brand px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "text-muted hover:bg-[var(--color-surface-soft)] hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}
