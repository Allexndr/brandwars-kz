"use client";

import { useMemo, useState } from "react";
import type { MapContinent } from "@/components/HexWorldMap";

type Props = {
  continents: MapContinent[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  locale?: string;
};

/**
 * Quiet way to jump to a continent without advertising itself as a feature.
 * Sits in spare space beside the globe; empty until someone types or taps.
 */
export function ContinentFinder({
  continents,
  selectedSlug,
  onSelect,
  locale = "ru",
}: Props) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...continents].sort((a, b) =>
      a.continentName.localeCompare(b.continentName, "ru"),
    );
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.continentName.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q),
    );
  }, [continents, query]);

  return (
    <aside className="flex h-full min-h-[280px] flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)]/70 bg-[var(--color-surface)]/60 p-3">
      <label className="sr-only" htmlFor="continent-find">
        {locale === "kk" ? "Материк іздеу" : "Поиск материка"}
      </label>
      <input
        id="continent-find"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={locale === "kk" ? "Материк…" : "Материк…"}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/80 px-2.5 py-1.5 text-sm text-ink placeholder:text-muted/70"
      />

      <ul className="mt-2 max-h-[min(420px,55vh)] flex-1 space-y-0.5 overflow-y-auto text-sm">
        {matches.map((continent) => {
          const active = continent.slug === selectedSlug;
          return (
            <li key={continent.slug}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : continent.slug)}
                className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition ${
                  active
                    ? "bg-ink text-white"
                    : "text-ink/80 hover:bg-black/[0.04]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: continent.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="block truncate font-medium leading-tight">
                    {continent.continentName}
                  </span>
                  <span
                    className={`block truncate text-[11px] leading-tight ${
                      active ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {continent.name}
                    {continent.brandCount > 0
                      ? ` · ${continent.brandCount}`
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {matches.length === 0 ? (
          <li className="px-2 py-3 text-xs text-muted">
            {locale === "kk" ? "Табылмады" : "Ничего нет"}
          </li>
        ) : null}
      </ul>
    </aside>
  );
}
