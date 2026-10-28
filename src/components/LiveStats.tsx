"use client";

import { useEffect, useState } from "react";

type Stats = {
  online: number;
  totalVisits: number;
  brands: number;
  openContests: number;
};

/**
 * "N online · M visits" — the first social proof a visitor sees.
 *
 * The same request that reads the counters is also the visit heartbeat, so
 * mounting this component is what registers the visitor.
 */
export function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;

    async function ping() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Stats;
        if (alive) setStats(data);
      } catch {
        // A missing counter must never break the page.
      }
    }

    void ping();
    const timer = setInterval(ping, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!stats) {
    // Reserve the line so the header does not jump when numbers arrive.
    return <p className="h-5 text-xs text-muted" aria-hidden="true" />;
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
          aria-hidden="true"
        />
        <strong className="font-semibold text-ink">{stats.online}</strong> онлайн
      </span>
      <span aria-hidden="true">·</span>
      <span>
        <strong className="font-semibold text-ink">
          {stats.totalVisits.toLocaleString("ru-KZ")}
        </strong>{" "}
        посещений с момента запуска
      </span>
      {stats.openContests > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span className="text-[var(--color-primary)]">
            {stats.openContests} активных окон
          </span>
        </>
      )}
    </p>
  );
}
