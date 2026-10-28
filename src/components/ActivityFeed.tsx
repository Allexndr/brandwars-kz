"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";

type ActivityEvent = {
  id: string;
  type: string;
  amountKzt: number | null;
  createdAt: string;
  brand: {
    slug: string;
    name: string;
    logoUrl: string | null;
    rank: number | null;
  } | null;
  category: { slug: string; nameRu: string; nameKk: string; color: string };
  scope: { slug: string; nameRu: string; nameKk: string };
};

/**
 * The chronicle: proof the planet is moving without you.
 *
 * Every line is a real recorded event, not a simulated ticker — the land and
 * contest code already writes them.
 */
const LABELS: Record<string, string> = {
  CLAIMED: "занял клетку",
  REINFORCED: "усилился в окне",
  CONTEST_OPENED: "открыл окно противостояния",
  CONTEST_WON: "забрал клетку",
  CONTEST_HELD: "удержал клетку",
  FADING_STARTED: "клетка тускнеет",
  RELEASED: "клетка освободилась",
  FRONTIER_EXPANDED: "материк вырос",
};

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

export function ActivityFeed({
  locale = "ru",
  categorySlug,
  limit = 15,
}: {
  locale?: string;
  categorySlug?: string;
  limit?: number;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      const params = new URLSearchParams({ limit: String(limit) });
      if (categorySlug) params.set("category", categorySlug);
      try {
        const res = await fetch(`/api/activity?${params}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setEvents(data.events ?? []);
      } catch {
        // Silent: the feed is enrichment, not a dependency.
      } finally {
        if (alive) setLoaded(true);
      }
    }

    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [categorySlug, limit]);

  if (loaded && events.length === 0) return null;

  return (
    <section className="surface-card">
      <h2 className="font-display text-lg font-semibold text-ink">
        Последняя активность
      </h2>

      <ul className="mt-4 divide-y divide-[var(--color-border)]">
        {events.map((event) => {
          const categoryName =
            locale === "kk" ? event.category.nameKk : event.category.nameRu;

          return (
            <li key={event.id} className="flex items-baseline gap-3 py-2.5">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: event.category.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  {event.brand ? (
                    <Link
                      href={`/brand/${event.brand.slug}`}
                      className="font-medium hover:text-[var(--color-primary)]"
                    >
                      {event.brand.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{categoryName}</span>
                  )}{" "}
                  <span className="text-muted">
                    {LABELS[event.type] ?? event.type.toLowerCase()}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                  <span>{categoryName}</span>
                  {event.brand?.rank ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>#{event.brand.rank}</span>
                    </>
                  ) : null}
                  {event.amountKzt ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-ink">
                        {event.amountKzt.toLocaleString("ru-KZ")} ₸
                      </span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>{timeAgo(event.createdAt)}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
