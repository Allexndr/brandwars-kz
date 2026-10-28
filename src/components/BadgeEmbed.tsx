"use client";

import { useState } from "react";

/**
 * The embed snippet a brand copies onto its own site.
 *
 * This is the cheapest growth loop the product has: the brand advertises us to
 * its own audience and hands us a backlink, while getting public proof of its
 * position. The badge updates itself, so losing a place changes the image on
 * the brand's own homepage — which is its own reason to top up.
 *
 * Shipped with the copy button because a snippet nobody can copy in one click
 * does not get installed.
 */
export function BadgeEmbed({
  brandSlug,
  baseUrl,
}: {
  brandSlug: string;
  baseUrl: string;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);

  const badgeUrl = `${baseUrl}/api/badge/${brandSlug}${theme === "dark" ? "?theme=dark" : ""}`;
  const pageUrl = `${baseUrl}/ru/brand/${brandSlug}`;
  const snippet = `<a href="${pageUrl}" target="_blank" rel="noopener">\n  <img src="${badgeUrl}" alt="Позиция на карте BrandWars" height="52" />\n</a>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="surface-card space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Бейдж для вашего сайта
        </h2>
        <p className="mt-1 text-sm text-muted">
          Обновляется сам: позиция на бейдже всегда актуальная. Вставьте код в
          любое место страницы.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-brand bg-[var(--color-surface-soft)] p-1">
          {(["light", "dark"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTheme(option)}
              className={`rounded-brand px-3 py-1 text-sm font-medium transition ${
                theme === option
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option === "light" ? "Светлый" : "Тёмный"}
            </button>
          ))}
        </div>

        <div
          className={`rounded-brand p-3 ${
            theme === "dark" ? "bg-[#0f172a]" : "bg-[var(--color-surface-soft)]"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badgeUrl}
            alt="Предпросмотр бейджа"
            height={52}
            className="block"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="badge-snippet"
          className="block text-sm font-medium text-ink"
        >
          Код для вставки
        </label>
        <textarea
          id="badge-snippet"
          readOnly
          value={snippet}
          rows={4}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-brand border border-[var(--color-border)] bg-white p-3 font-mono text-xs text-ink"
        />
        <button type="button" onClick={copy} className="btn-primary text-sm">
          {copied ? "Скопировано" : "Скопировать код"}
        </button>
      </div>
    </section>
  );
}
