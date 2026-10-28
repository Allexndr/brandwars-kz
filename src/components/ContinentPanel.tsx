"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";

type ArenaStats = {
  category: { slug: string; name: string; continent: string; color: string };
  scope: { slug: string; name: string };
  pricing: {
    entryMinimumKzt: number;
    cheapestFreeCellKzt: number | null;
    takeFirstPlaceKzt: number;
    challengeLeaderFromKzt: number | null;
    medianClaimSpendKzt: number | null;
    medianWinningBidKzt: number | null;
  };
  capacity: {
    totalCells: number;
    freeCells: number;
    occupancyPercent: number;
    canEnterWithoutContest: boolean;
    releasedLast24h: number;
  };
  outcomes: {
    contestsFinished: number;
    defenceHeldPercent: number | null;
    defenceSample: number;
    openContests: number;
  };
  attention: {
    participants: number;
    clicksLast24h: number;
    totalClicks: number;
    medianClicksPerBrand: number | null;
  };
  participants: {
    rank: number;
    slug: string;
    name: string;
    logoUrl: string | null;
    verified: boolean;
    cellCount: number;
    clickCount: number;
    amountKzt: number;
    takeThisPlaceKzt: number;
  }[];
};

/**
 * Everything a buyer needs about one continent, in one panel.
 *
 * The metrics are the selling argument, so they have to survive scrutiny: each
 * one comes from this arena's own history and carries its sample size. Where
 * there is no history the panel says so rather than showing a confident number
 * nobody computed — an invented "chance of holding" would be a fabricated
 * statistic used to close a sale.
 */
export function ContinentPanel({
  categorySlug,
  scopeSlug = "kz",
  locale = "ru",
  onClose,
}: {
  categorySlug: string;
  scopeSlug?: string;
  locale?: string;
  onClose?: () => void;
}) {
  const [stats, setStats] = useState<ArenaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ category: categorySlug, scope: scopeSlug, locale });
    fetch(`/api/arena-stats?${params}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Ошибка");
        return res.json();
      })
      .then((data) => {
        if (alive) setStats(data);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Ошибка");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [categorySlug, scopeSlug, locale]);

  if (loading) {
    return (
      <div className="surface-card text-center text-muted">Загружаем материк…</div>
    );
  }
  if (error || !stats) {
    return (
      <div className="surface-card text-center text-muted">
        {error ?? "Материк недоступен"}
      </div>
    );
  }

  const { pricing, capacity, outcomes, attention } = stats;

  return (
    <div className="surface-card space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: stats.category.color }}
          >
            {stats.category.name}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
            «{stats.category.continent}»
          </h2>
          <p className="mt-1 text-sm text-muted">
            {attention.participants} брендов · {capacity.occupancyPercent}% земли занято
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Закрыть
          </button>
        )}
      </header>

      {/* The single most important fact for a buyer: can I get in right now. */}
      <div
        className={`rounded-brand px-4 py-3 ${
          capacity.canEnterWithoutContest
            ? "bg-[var(--color-surface-soft)]"
            : "bg-[var(--color-surface-soft)]"
        }`}
      >
        {capacity.canEnterWithoutContest ? (
          <>
            <p className="text-sm text-ink">
              <strong>Можно зайти сразу</strong> — свободно {capacity.freeCells} клеток,
              бороться ни с кем не нужно.
            </p>
            {pricing.cheapestFreeCellKzt !== null && (
              <p className="mt-1 text-sm text-muted">
                Самая дешёвая свободная клетка —{" "}
                <strong className="text-ink">
                  {pricing.cheapestFreeCellKzt.toLocaleString("ru-KZ")} ₸
                </strong>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink">
            <strong>Земля занята полностью.</strong> Зайти можно через окно
            противостояния — от{" "}
            {(pricing.challengeLeaderFromKzt ?? pricing.entryMinimumKzt).toLocaleString("ru-KZ")} ₸,
            либо дождаться, пока клетка освободится.
          </p>
        )}
        {capacity.releasedLast24h > 0 && (
          <p className="mt-1 text-xs text-muted">
            За сутки освободилось {capacity.releasedLast24h} клеток
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Вход от" value={`${pricing.entryMinimumKzt.toLocaleString("ru-KZ")} ₸`} />
        <Metric
          label="Занять #1"
          value={`${pricing.takeFirstPlaceKzt.toLocaleString("ru-KZ")} ₸`}
          accent
        />
        <Metric
          label="Переходов за сутки"
          value={attention.clicksLast24h.toLocaleString("ru-KZ")}
        />
        <Metric
          label="Свободных клеток"
          value={`${capacity.freeCells} / ${capacity.totalCells}`}
        />
      </dl>

      {/* Outcome stats, each with its sample size. */}
      <section className="rounded-brand border border-[var(--color-border)] p-4">
        <h3 className="text-sm font-semibold text-ink">Что показывает история материка</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted">Владелец удерживает клетку</span>
            {outcomes.defenceHeldPercent !== null ? (
              <span className="font-medium text-ink">
                {outcomes.defenceHeldPercent}% случаев
                <span className="ml-1 text-xs font-normal text-muted">
                  ({outcomes.defenceSample}{" "}
                  {outcomes.defenceSample === 1 ? "окно" : "окон"})
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted">Окон пока не было — данных нет</span>
            )}
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted">Медианная выигрышная ставка</span>
            {pricing.medianWinningBidKzt !== null ? (
              <span className="font-medium text-ink">
                {pricing.medianWinningBidKzt.toLocaleString("ru-KZ")} ₸
              </span>
            ) : (
              <span className="text-xs text-muted">данных нет</span>
            )}
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted">Медианная покупка клетки</span>
            {pricing.medianClaimSpendKzt !== null ? (
              <span className="font-medium text-ink">
                {pricing.medianClaimSpendKzt.toLocaleString("ru-KZ")} ₸
              </span>
            ) : (
              <span className="text-xs text-muted">данных нет</span>
            )}
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted">Медиана переходов на бренд</span>
            {attention.medianClicksPerBrand !== null ? (
              <span className="font-medium text-ink">
                {attention.medianClicksPerBrand}
              </span>
            ) : (
              <span className="text-xs text-muted">данных нет</span>
            )}
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Все числа — из истории этого материка. Это игровая статистика платформы,
          а не прогноз и не оценка качества брендов.
        </p>
      </section>

      {outcomes.openContests > 0 && (
        <p className="rounded-brand bg-[var(--color-surface-soft)] px-4 py-2 text-sm text-[var(--color-primary)]">
          Сейчас идёт {outcomes.openContests}{" "}
          {outcomes.openContests === 1 ? "окно" : "окон"} противостояния
        </p>
      )}

      {stats.participants.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-ink">Участники</h3>
          <ol className="mt-3 space-y-2">
            {stats.participants.slice(0, 8).map((p) => (
              <li
                key={p.slug}
                className="flex flex-wrap items-center gap-3 rounded-brand bg-[var(--color-surface-soft)] px-3 py-2"
              >
                <span className="w-7 font-display text-sm font-semibold tabular-nums text-[var(--color-primary)]">
                  #{p.rank}
                </span>
                <Link
                  href={`/brand/${p.slug}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-[var(--color-primary)]"
                >
                  {p.name}
                </Link>
                <span className="text-xs text-muted">{p.cellCount} кл.</span>
                <span className="text-xs text-muted">{p.clickCount} перех.</span>
                <span className="text-sm font-medium tabular-nums text-ink">
                  {p.amountKzt.toLocaleString("ru-KZ")} ₸
                </span>
                <Link
                  href={`/claim-brand?category=${stats.category.slug}&amount=${p.takeThisPlaceKzt}`}
                  className="btn-primary px-3 py-1 text-xs"
                >
                  Занять за {p.takeThisPlaceKzt.toLocaleString("ru-KZ")} ₸
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-4">
        <Link
          href={`/claim-brand?category=${stats.category.slug}&amount=${
            pricing.cheapestFreeCellKzt ?? pricing.entryMinimumKzt
          }`}
          className="btn-primary flex-1 text-center"
        >
          Занять место в «{stats.category.continent}»
        </Link>
        <Link
          href={`/category/${stats.category.slug}`}
          className="btn-secondary flex-1 text-center"
        >
          Открыть материк
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-brand bg-[var(--color-surface-soft)] px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-0.5 font-display text-base font-semibold tabular-nums ${
          accent ? "text-[var(--color-primary)]" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
