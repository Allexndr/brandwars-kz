"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/routing";

export type LeaderboardEntry = {
  brandSlug: string;
  brandName: string;
  description: string | null;
  favicon: string | null;
  domain: string | null;
  goUrl: string | null;
  categorySlug: string;
  categoryName: string;
  categoryColor: string;
  rank: number;
  displayRank: number;
  cellCount: number;
  clickCount: number;
  clicksToday: number;
  amountKzt: number;
  amountTodayKzt: number;
  takeThisPlaceKzt: number;
  lastActivityAt: string | null;
  verificationStatus: string;
};

type Props = {
  locale?: string;
  categorySlug?: string;
  initialPeriod?: "all" | "today";
};

/** "8 мин назад" — the freshness signal that makes a list feel alive. */
function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export function BrandLeaderboard({
  locale = "ru",
  categorySlug,
  initialPeriod = "all",
}: Props) {
  const [period, setPeriod] = useState<"all" | "today">(initialPeriod);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const params = new URLSearchParams({ period, locale });
    if (categorySlug) params.set("category", categorySlug);

    fetch(`/api/leaderboard?${params}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data) => {
        if (alive) setEntries(data.entries ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [period, locale, categorySlug]);

  const tabs = useMemo(
    () =>
      [
        { id: "all" as const, label: "За всё время" },
        { id: "today" as const, label: "Сегодня" },
      ],
    [],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-ink">Рейтинг</h2>
        <div
          className="flex gap-1 rounded-brand bg-[var(--color-surface-soft)] p-1"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={period === tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`rounded-brand px-3 py-1.5 text-sm font-medium transition ${
                period === tab.id
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <p className="surface-card text-center text-muted">Загружаем рейтинг…</p>
      ) : entries.length === 0 ? (
        <p className="surface-card text-center text-muted">
          Пока никто не занял место. Первое место свободно.
        </p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry, index) => (
            <li key={`${entry.categorySlug}-${entry.brandSlug}`}>
              {/* An aspirational threshold: visible proof of what to reach for. */}
              {index === 10 && (
                <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span className="h-px flex-1 bg-[var(--color-border)]" />
                  Топ 10
                  <span className="h-px flex-1 bg-[var(--color-border)]" />
                </p>
              )}
              <BrandRow entry={entry} period={period} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function BrandRow({
  entry,
  period,
}: {
  entry: LeaderboardEntry;
  period: "all" | "today";
}) {
  const clicks = period === "today" ? entry.clicksToday : entry.clickCount;
  const amount = period === "today" ? entry.amountTodayKzt : entry.amountKzt;

  return (
    <article className="surface-card flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex items-start gap-3 sm:flex-1">
        <span className="mt-0.5 w-8 shrink-0 font-display text-lg font-semibold tabular-nums text-[var(--color-primary)]">
          #{entry.displayRank}
        </span>

        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-brand text-sm font-semibold text-white"
          style={{ backgroundColor: entry.categoryColor }}
          aria-hidden="true"
        >
          {entry.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.favicon}
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            entry.brandName.charAt(0).toUpperCase()
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link
              href={`/brand/${entry.brandSlug}`}
              className="font-semibold text-ink hover:text-[var(--color-primary)]"
            >
              {entry.brandName}
            </Link>
            {entry.verificationStatus === "VERIFIED" && (
              <span className="rounded-full bg-[var(--color-surface-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                Проверен
              </span>
            )}
          </div>

          {entry.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">
              {entry.description}
            </p>
          )}

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>{timeAgo(entry.lastActivityAt)}</span>
            {entry.domain && (
              <>
                <span aria-hidden="true">·</span>
                <span>{entry.domain}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <Link
              href={`/category/${entry.categorySlug}`}
              className="hover:text-ink"
            >
              {entry.categoryName}
            </Link>
            <span aria-hidden="true">·</span>
            {/* The number that justifies paying again. */}
            <span className="font-medium text-ink">{clicks} переходов</span>
            {entry.cellCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{entry.cellCount} клеток</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-52 sm:items-end">
        <p className="font-display text-lg font-semibold tabular-nums text-ink sm:text-right">
          {amount.toLocaleString("ru-KZ")} ₸
        </p>
        <div className="flex gap-2 sm:flex-col">
          {entry.goUrl && (
            <a
              href={entry.goUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn-secondary flex-1 text-center text-sm sm:w-full"
            >
              Перейти
            </a>
          )}
          {/* The precomputed price is the difference between a table you read
              and a list you buy from. */}
          <Link
            href={`/claim-brand?category=${entry.categorySlug}&amount=${entry.takeThisPlaceKzt}`}
            className="btn-primary flex-1 text-center text-sm sm:w-full"
          >
            Занять за {entry.takeThisPlaceKzt.toLocaleString("ru-KZ")} ₸
          </Link>
        </div>
      </div>
    </article>
  );
}
