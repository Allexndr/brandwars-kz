"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";

type Contest = {
  id: string;
  closesAt: string;
  challengerKzt: number;
  defenderKzt: number;
  leading: "CHALLENGER" | "DEFENDER";
  gapKzt: number;
  category: { slug: string; nameRu: string };
  challenger: { slug: string; name: string } | null;
  defender: { slug: string; name: string } | null;
};

/**
 * Live siege windows with a running clock.
 *
 * This is the only element on the page that gives a reason to come back at a
 * specific time — the clock is the product.
 */
function formatLeft(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "закрывается";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} ч ${minutes.toString().padStart(2, "0")} мин`;
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ContestCountdown({ limit = 3 }: { limit?: number }) {
  const [contests, setContests] = useState<Contest[]>([]);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch(`/api/contests?limit=${limit}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setContests(data.contests ?? []);
      } catch {
        // Enrichment only.
      }
    }

    void load();
    const poll = setInterval(load, 20_000);
    // Re-render every second so the clock actually ticks.
    const tick = setInterval(() => forceTick((n) => n + 1), 1000);

    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [limit]);

  if (contests.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink">
        Идут окна противостояния
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contests.map((contest) => {
          const defenderAhead = contest.leading === "DEFENDER";
          return (
            <li
              key={contest.id}
              className="surface-card border-l-2 border-[var(--color-primary)]"
            >
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-muted">
                  {contest.category.nameRu}
                </span>
                <span className="font-display text-sm font-semibold tabular-nums text-[var(--color-primary)]">
                  {formatLeft(contest.closesAt)}
                </span>
              </p>

              <p className="mt-2 text-sm text-ink">
                <span className="font-medium">
                  {contest.challenger?.name ?? "Претендент"}
                </span>
                <span className="text-muted"> претендует на клетку </span>
                <span className="font-medium">
                  {contest.defender?.name ?? "владельца"}
                </span>
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Претендент</dt>
                  <dd className="font-display text-sm font-semibold tabular-nums text-ink">
                    {contest.challengerKzt.toLocaleString("ru-KZ")} ₸
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Защита</dt>
                  <dd className="font-display text-sm font-semibold tabular-nums text-ink">
                    {contest.defenderKzt.toLocaleString("ru-KZ")} ₸
                  </dd>
                </div>
              </dl>

              <p className="mt-2 text-xs text-muted">
                {defenderAhead ? "Клетка удерживается" : "Клетка уходит"} ·
                разница {contest.gapKzt.toLocaleString("ru-KZ")} ₸
              </p>

              <Link
                href={`/category/${contest.category.slug}`}
                className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                Смотреть материк →
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
