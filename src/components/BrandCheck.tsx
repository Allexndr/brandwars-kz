"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { formatApiError } from "@/lib/format-api-error";

type CheckResult = {
  input: { url: string; hostname: string };
  brand: { name: string; description: string | null; favicon: string | null };
  alreadyOnMap: {
    slug: string;
    name: string;
    rank: number | null;
    cellCount: number;
    clickCount: number;
  } | null;
  category: {
    slug: string;
    name: string;
    continent: string;
    color: string;
    guessed: boolean;
  };
  market: {
    participants: number;
    leaderName: string | null;
    leaderSpendKzt: number | null;
    leaderClicks: number | null;
    totalClicks: number;
    costPerClickKzt: number | null;
    freeCells: number;
    canEnterNow: boolean;
  };
  yourEntry: {
    entryKzt: number;
    cheapestFreeCellKzt: number | null;
    projectedRank: number;
    takeFirstPlaceKzt: number;
  };
};

/**
 * The free check: paste a link, get a real report, no signup.
 *
 * The point is to reach the moment where the value is obvious before asking for
 * anything — so the only input is a URL, and the answer is made of figures the
 * platform actually holds rather than a projection dressed up as one.
 */
export function BrandCheck({ locale = "ru" }: { locale?: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Не удалось проверить"));
      setResult(data as CheckResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="surface-card space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            Проверьте свой бренд — бесплатно
          </h2>
          <p className="mt-1 text-sm text-muted">
            Вставьте ссылку и узнайте, кто занимает вашу категорию, сколько он
            вложил и что нужно, чтобы его обойти. Без регистрации.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim().length > 3) void check();
            }}
            placeholder="site.kz или @handle"
            className="flex-1 rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={check}
            disabled={loading || url.trim().length < 4}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Проверяем…" : "Проверить"}
          </button>
        </div>

        {error && (
          <p className="rounded-brand bg-[var(--color-surface-soft)] px-3 py-2 text-sm text-[var(--color-primary)]">
            {error}
          </p>
        )}
      </div>

      {result && (
        <div className="surface-card space-y-5">
          <header className="flex flex-wrap items-start gap-3">
            {result.brand.favicon && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={result.brand.favicon}
                alt=""
                width={36}
                height={36}
                className="mt-0.5 h-9 w-9 rounded-brand object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-xl font-semibold text-ink">
                {result.brand.name}
              </h3>
              <p className="text-sm text-muted">{result.input.hostname}</p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: result.category.color }}
            >
              {result.category.continent}
            </span>
          </header>

          {result.alreadyOnMap ? (
            <div className="rounded-brand bg-[var(--color-surface-soft)] px-4 py-3">
              <p className="text-sm text-ink">
                <strong>Этот бренд уже на карте</strong> — «
                {result.alreadyOnMap.name}»
                {result.alreadyOnMap.rank
                  ? `, место #${result.alreadyOnMap.rank}`
                  : ""}
                , {result.alreadyOnMap.clickCount} переходов.
              </p>
              <Link
                href={`/brand/${result.alreadyOnMap.slug}`}
                className="mt-1 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                Открыть страницу бренда →
              </Link>
            </div>
          ) : (
            <p className="rounded-brand bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-ink">
              Похоже, вашего бренда на карте ещё нет.{" "}
              {result.category.guessed
                ? `Категория определена по ссылке как «${result.category.name}» — при размещении её можно сменить.`
                : `Категория — «${result.category.name}».`}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Cell
              label="Участников в категории"
              value={String(result.market.participants)}
            />
            <Cell
              label="Свободных клеток"
              value={String(result.market.freeCells)}
            />
            <Cell
              label="Вход"
              value={`${result.yourEntry.entryKzt.toLocaleString("ru-KZ")} ₸`}
            />
            <Cell
              label="Занять #1"
              value={`${result.yourEntry.takeFirstPlaceKzt.toLocaleString("ru-KZ")} ₸`}
              accent
            />
          </dl>

          {result.market.leaderName && (
            <section className="rounded-brand border border-[var(--color-border)] p-4">
              <h4 className="text-sm font-semibold text-ink">
                Кто держит категорию сейчас
              </h4>
              <ul className="mt-2 space-y-1.5 text-sm">
                <Row label="Лидер" value={result.market.leaderName} />
                {result.market.leaderSpendKzt !== null && (
                  <Row
                    label="Вложил"
                    value={`${result.market.leaderSpendKzt.toLocaleString("ru-KZ")} ₸`}
                  />
                )}
                {result.market.leaderClicks !== null && (
                  <Row
                    label="Получил переходов"
                    value={String(result.market.leaderClicks)}
                  />
                )}
                {result.market.costPerClickKzt !== null ? (
                  <Row
                    label="Стоимость перехода в категории"
                    value={`${result.market.costPerClickKzt.toLocaleString("ru-KZ")} ₸`}
                  />
                ) : (
                  <Row
                    label="Стоимость перехода"
                    value="переходов пока мало — считать не на чем"
                    muted
                  />
                )}
              </ul>
            </section>
          )}

          <div className="rounded-brand bg-[var(--color-surface-soft)] px-4 py-3">
            {result.market.canEnterNow ? (
              <p className="text-sm text-ink">
                <strong>Зайти можно прямо сейчас</strong> — есть свободная земля,
                бороться ни с кем не нужно
                {result.yourEntry.cheapestFreeCellKzt !== null
                  ? `, от ${result.yourEntry.cheapestFreeCellKzt.toLocaleString("ru-KZ")} ₸`
                  : ""}
                . За {result.yourEntry.entryKzt.toLocaleString("ru-KZ")} ₸ вы
                встанете примерно на #{result.yourEntry.projectedRank}.
              </p>
            ) : (
              <p className="text-sm text-ink">
                Земля в категории занята — зайти можно через окно
                противостояния или дождаться, пока клетка освободится.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-4">
            <Link
              href={`/claim-brand?category=${result.category.slug}&amount=${
                result.yourEntry.cheapestFreeCellKzt ?? result.yourEntry.entryKzt
              }`}
              className="btn-primary flex-1 text-center"
            >
              Занять место за{" "}
              {(
                result.yourEntry.cheapestFreeCellKzt ?? result.yourEntry.entryKzt
              ).toLocaleString("ru-KZ")}{" "}
              ₸
            </Link>
            <Link
              href={`/category/${result.category.slug}`}
              className="btn-secondary flex-1 text-center"
            >
              Посмотреть категорию
            </Link>
          </div>

          <p className="text-xs text-muted">
            Все числа — из реальных данных платформы. Позиция определяется
            оплаченной суммой, а не оценкой качества бренда.
          </p>
        </div>
      )}
    </div>
  );
}

function Cell({
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

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={muted ? "text-xs text-muted" : "font-medium text-ink"}>
        {value}
      </span>
    </li>
  );
}
