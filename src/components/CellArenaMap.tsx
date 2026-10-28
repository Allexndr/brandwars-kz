"use client";

import { realmNameBySlug } from "@/lib/scopes";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/routing";
import { hexPolygonPoints, hexToPixel } from "@/lib/hex";

type ArenaCell = {
  id: string;
  q: number;
  r: number;
  ring: number;
  layer: "CAPITAL" | "CORE" | "FRONTIER";
  state: "NEUTRAL" | "HELD" | "FADING" | "CONTESTED";
  priceKzt: number;
  investedKzt: number;
  upkeepDueAt: string | null;
  fadingExpiresAt: string | null;
  challengeFromKzt: number;
  owner: { slug: string; name: string; logoUrl: string | null } | null;
  contest: {
    id: string;
    closesAt: string;
    challengerKzt: number;
    defenderKzt: number;
    challenger: string;
    defender: string | null;
  } | null;
};

type ArenaResponse = {
  arena: {
    scopeSlug: string;
    scopeNameRu: string;
    scopeNameKk: string;
    coreRadius: number;
    frontierRadius: number;
    claimableCells: number;
    occupiedCells: number;
    occupancy: number;
  };
  cells: ArenaCell[];
};

function brandColor(slug: string) {
  const palette = [
    "#0F766E",
    "#C2410C",
    "#2563EB",
    "#7C3AED",
    "#BE185D",
    "#4D7C0F",
    "#B45309",
  ];
  const hash = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-KZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function countdown(value: string) {
  const diff = Math.max(0, new Date(value).getTime() - Date.now());
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours} ч ${minutes.toString().padStart(2, "0")} мин`;
}

export function CellArenaMap({
  categorySlug,
  locale = "ru",
  scope = "kz",
}: {
  categorySlug: string;
  locale?: string;
  scope?: string;
}) {
  const [data, setData] = useState<ArenaResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(
          `/api/cells?category=${encodeURIComponent(categorySlug)}&scope=${encodeURIComponent(scope)}`,
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить клетки");
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Ошибка карты");
        }
      }
    }
    load();
    const refresh = setInterval(load, 20_000);
    const clock = setInterval(() => tick((value) => value + 1), 30_000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [categorySlug, scope]);

  const geometry = useMemo(() => {
    if (!data) return [];
    const size = 27;
    const raw = data.cells.map((cell) => ({
      cell,
      point: hexToPixel({ q: cell.q, r: cell.r }, size),
    }));
    const xs = raw.map(({ point }) => point.x);
    const ys = raw.map(({ point }) => point.y);
    const minX = Math.min(...xs) - size - 8;
    const minY = Math.min(...ys) - size - 8;
    return raw.map(({ cell, point }) => ({
      cell,
      x: point.x - minX,
      y: point.y - minY,
      points: hexPolygonPoints(point.x - minX, point.y - minY, size - 1)
        .map((value) => value.toFixed(1))
        .join(","),
    }));
  }, [data]);

  const selected = data?.cells.find((cell) => cell.id === selectedId) ?? null;
  const width = geometry.length ? Math.max(...geometry.map((item) => item.x)) + 36 : 600;
  const height = geometry.length ? Math.max(...geometry.map((item) => item.y)) + 36 : 420;

  function fill(cell: ArenaCell) {
    if (cell.layer === "CAPITAL") return "#F59E0B";
    if (cell.owner) return brandColor(cell.owner.slug);
    return cell.layer === "CORE" ? "#E8D8B0" : "#9FC69D";
  }

  if (error && !data) {
    return (
      <div className="surface-card text-sm text-muted">
        Живая сетка временно недоступна: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="surface-card flex min-h-72 items-center justify-center text-sm text-muted">
        Загружаем живую сетку...
      </div>
    );
  }

  const scopeName = locale === "kk" ? data.arena.scopeNameKk : data.arena.scopeNameRu;
  // The map is a fictional world, not a political map of a real place.
  const realmLabel =
    realmNameBySlug(data.arena.scopeSlug, locale) ?? `Земли · ${scopeName}`;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[#0a1a22]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-white/50">{realmLabel}</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Земля категории</h2>
        </div>
        <div className="text-right text-xs text-white/60">
          <p>{data.arena.occupiedCells} из {data.arena.claimableCells} клеток занято</p>
          <p>{Math.round(data.arena.occupancy * 100)}% заполнения</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-[430px] overflow-auto p-4">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="mx-auto h-auto min-w-[520px] max-w-[760px]"
            role="img"
            aria-label="Интерактивная сетка клеток категории"
          >
            <defs>
              <pattern id="fading-stripes" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" stroke="white" strokeOpacity=".45" strokeWidth="2" />
              </pattern>
            </defs>
            {geometry.map(({ cell, points, x, y }) => (
              <g
                key={cell.id}
                role="button"
                tabIndex={0}
                aria-label={`${cell.layer === "CORE" ? "Ядро" : cell.layer === "FRONTIER" ? "Фронтир" : "Столица"}: ${cell.owner?.name ?? (cell.layer === "CAPITAL" ? "не продаётся" : `свободно, ${cell.priceKzt.toLocaleString("ru-KZ")} ₸`)}`}
                className="cursor-pointer outline-none"
                onClick={() => setSelectedId(cell.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedId(cell.id);
                }}
              >
                <polygon
                  points={points}
                  fill={fill(cell)}
                  fillOpacity={cell.state === "FADING" ? 0.5 : cell.layer === "FRONTIER" ? 0.82 : 0.96}
                  stroke={
                    cell.id === selectedId
                      ? "#FFFFFF"
                      : cell.state === "CONTESTED"
                        ? "#FB923C"
                        : "#17343D"
                  }
                  strokeWidth={cell.id === selectedId || cell.state === "CONTESTED" ? 3 : 1.2}
                />
                {cell.state === "FADING" && <polygon points={points} fill="url(#fading-stripes)" />}
                {cell.layer === "CAPITAL" && (
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="15">
                    ★
                  </text>
                )}
                {cell.state === "CONTESTED" && (
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#FFF7ED"
                  />
                )}
              </g>
            ))}
          </svg>
        </div>

        <aside className="border-t border-white/10 bg-black/20 p-5 text-white lg:border-l lg:border-t-0">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-white/45">
                  {selected.layer === "CORE"
                    ? "Ядро материка"
                    : selected.layer === "FRONTIER"
                      ? "Фронтир"
                      : "Столица"}
                </p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {selected.owner?.name ?? (selected.layer === "CAPITAL" ? "Столица" : "Свободная клетка")}
                </p>
              </div>

              {selected.contest ? (
                <div className="rounded-brand bg-orange-500/15 p-3 text-sm">
                  <p className="font-semibold text-orange-200">Окно внимания открыто</p>
                  <p className="mt-1 text-white/70">
                    {selected.contest.challengerKzt.toLocaleString("ru-KZ")} ₸ против{" "}
                    {selected.contest.defenderKzt.toLocaleString("ru-KZ")} ₸
                  </p>
                  <p className="mt-1 text-white/55">
                    Осталось {countdown(selected.contest.closesAt)}
                  </p>
                </div>
              ) : (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-white/50">{selected.owner ? "Участие от" : "Цена"}</dt>
                    <dd>{selected.challengeFromKzt.toLocaleString("ru-KZ")} ₸</dd>
                  </div>
                  {selected.upkeepDueAt && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-white/50">Поддержать до</dt>
                      <dd>{formatDate(selected.upkeepDueAt, locale)}</dd>
                    </div>
                  )}
                  {selected.fadingExpiresAt && (
                    <div className="flex justify-between gap-3 text-orange-200">
                      <dt>Вернётся в нейтральные</dt>
                      <dd>{formatDate(selected.fadingExpiresAt, locale)}</dd>
                    </div>
                  )}
                </dl>
              )}

              {selected.layer !== "CAPITAL" && (
                <Link
                  href={`/claim-brand?category=${categorySlug}`}
                  className="inline-flex w-full items-center justify-center rounded-brand bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-orange-50"
                >
                  {selected.owner ? "Участвовать через кабинет" : "Разместить бренд"}
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-sm text-white/60">
              <p className="font-semibold text-white">Выберите клетку</p>
              <p>Ядро ограничено навсегда. Зелёный фронтир расширяется, когда карта заполняется.</p>
              <p>Тусклые клетки можно вернуть поддержкой. Оранжевая рамка означает открытое окно внимания.</p>
            </div>
          )}
        </aside>
      </div>

      <footer className="flex flex-wrap gap-4 border-t border-white/10 px-5 py-3 text-[11px] text-white/50">
        <span>★ столица не продаётся</span>
        <span>светлое ядро ограничено</span>
        <span>зелёный фронтир растёт</span>
        <span>тусклое скоро освободится</span>
      </footer>
    </section>
  );
}
