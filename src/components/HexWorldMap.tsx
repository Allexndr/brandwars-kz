"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import {
  hexKey,
  hexPolygonPoints,
  hexSpiral,
  hexToPixel,
  pixelToHex,
  hashHex,
  type Hex,
} from "@/lib/hex";

export type MapTerritory = {
  id: string;
  slug: string;
  name: string;
  territoryShare: number;
  rank: number;
  color: string;
  rankLabel?: string;
  websiteUrl?: string | null;
  categorySlug: string;
};

export type MapContinent = {
  slug: string;
  name: string;
  continentName: string;
  color: string;
  brandCount: number;
  territories: MapTerritory[];
};

type Selected =
  | { kind: "brand"; territory: MapTerritory; continent: MapContinent }
  | { kind: "continent"; continent: MapContinent }
  | null;

type HexCell = {
  hex: Hex;
  kind: "ocean" | "land" | "brand";
  continentSlug?: string;
  territory?: MapTerritory;
  fill: number;
  stroke: number;
};

type Props = {
  continents: MapContinent[];
  locale?: string;
  height?: number;
  compact?: boolean;
  onContinentClick?: (slug: string) => void;
};

const CONTINENT_CENTERS: Hex[] = [
  { q: -10, r: -2 },
  { q: 2, r: -10 },
  { q: 10, r: -4 },
  { q: -8, r: 8 },
  { q: 4, r: 6 },
  { q: 12, r: 8 },
];

const OCEAN = 0x1a3a4a;
const OCEAN_DEEP = 0x122830;
const LAND_EMPTY = 0x3d5a3d;
const GRID_LINE = 0x0a1620;

function parseColor(hex: string, fallback = 0x38bdf8): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(n) ? n : fallback;
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.max(0, (color & 0xff) * factor));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function buildCells(continents: MapContinent[]): Map<string, HexCell> {
  const cells = new Map<string, HexCell>();

  // Ocean backdrop
  for (const h of hexSpiral({ q: 0, r: 0 }, 18)) {
    const deep = hashHex(h) > 0.55;
    cells.set(hexKey(h), {
      hex: h,
      kind: "ocean",
      fill: deep ? OCEAN_DEEP : OCEAN,
      stroke: GRID_LINE,
    });
  }

  continents.forEach((continent, ci) => {
    const center =
      continents.length === 1
        ? { q: 0, r: 0 }
        : CONTINENT_CENTERS[ci % CONTINENT_CENTERS.length];
    const radius =
      continents.length === 1
        ? Math.max(3, Math.min(5, 2 + Math.ceil(Math.sqrt(continent.territories.length || 1))))
        : continent.territories.length > 0
          ? 3
          : 2;
    const land = hexSpiral(center, radius);
    const base = parseColor(continent.color);

    // Assign contiguous hex chunks by share
    const claimed = new Set<string>();
    const sorted = [...continent.territories].sort(
      (a, b) => b.territoryShare - a.territoryShare,
    );
    const totalLand = land.length;
    let cursor = 0;

    for (const t of sorted) {
      const share = Math.max(0.08, t.territoryShare);
      const count = Math.max(1, Math.round(share * totalLand));
      for (let i = 0; i < count && cursor < land.length; i++) {
        const h = land[cursor++];
        const key = hexKey(h);
        claimed.add(key);
        const variance = 0.85 + hashHex(h) * 0.25;
        cells.set(key, {
          hex: h,
          kind: "brand",
          continentSlug: continent.slug,
          territory: t,
          fill: shade(parseColor(t.color || continent.color, base), variance),
          stroke: shade(base, 0.45),
        });
      }
    }

    for (const h of land) {
      const key = hexKey(h);
      if (claimed.has(key)) continue;
      const variance = 0.9 + hashHex(h) * 0.2;
      cells.set(key, {
        hex: h,
        kind: "land",
        continentSlug: continent.slug,
        fill: shade(LAND_EMPTY, variance),
        stroke: shade(base, 0.35),
      });
    }
  });

  return cells;
}

export function HexWorldMap({
  continents,
  locale = "ru",
  height = 520,
  compact = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const camera = useRef({ x: 0, y: 0, zoom: compact ? 0.55 : 0.85 });
  const drag = useRef<{ active: boolean; lx: number; ly: number }>({
    active: false,
    lx: 0,
    ly: 0,
  });
  const cellsRef = useRef<Map<string, HexCell>>(new Map());
  const sizeRef = useRef(18);

  const cells = useMemo(() => buildCells(continents), [continents]);
  cellsRef.current = cells;

  const continentBySlug = useMemo(
    () => Object.fromEntries(continents.map((c) => [c.slug, c])),
    [continents],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = height;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { x: camX, y: camY, zoom } = camera.current;
    const hexSize = sizeRef.current * zoom;

    ctx.fillStyle = "#0c1a22";
    ctx.fillRect(0, 0, w, h);

    // Soft vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, "rgba(26, 58, 74, 0.15)");
    grad.addColorStop(1, "rgba(8, 16, 22, 0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const selectedId =
      selected?.kind === "brand" ? selected.territory.id : selected?.continent.slug;

    for (const cell of cellsRef.current.values()) {
      const p = hexToPixel(cell.hex, hexSize);
      const cx = p.x + w / 2 + camX;
      const cy = p.y + h / 2 + camY;
      if (cx < -40 || cy < -40 || cx > w + 40 || cy > h + 40) continue;

      const pts = hexPolygonPoints(cx, cy, hexSize * 0.95);
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();

      const isSel =
        (cell.territory && cell.territory.id === selectedId) ||
        (selected?.kind === "continent" && cell.continentSlug === selectedId);

      ctx.fillStyle = `#${cell.fill.toString(16).padStart(6, "0")}`;
      ctx.globalAlpha = cell.kind === "ocean" ? 0.95 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isSel
        ? "#f8fafc"
        : `#${cell.stroke.toString(16).padStart(6, "0")}`;
      ctx.lineWidth = isSel ? 2.2 : cell.kind === "brand" ? 1.1 : 0.6;
      ctx.stroke();

      // Leader capital marker
      if (cell.territory?.rank === 1 && zoom > 0.45) {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2.5, hexSize * 0.22), 0, Math.PI * 2);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Continent labels
    if (zoom > 0.4) {
      continents.forEach((c, i) => {
        const center =
          continents.length === 1
            ? { q: 0, r: 0 }
            : CONTINENT_CENTERS[i % CONTINENT_CENTERS.length];
        const p = hexToPixel(center, hexSize);
        const cx = p.x + w / 2 + camX;
        const cy = p.y + h / 2 + camY - hexSize * (continents.length === 1 ? 4.5 : 3.2);
        ctx.font = `600 ${Math.max(11, 12 * zoom)}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(248,250,252,0.92)";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.65)";
        ctx.shadowBlur = 4;
        ctx.fillText(c.continentName || c.name, cx, cy);
        ctx.shadowBlur = 0;
      });
    }
  }, [continents, height, selected]);

  useEffect(() => {
    draw();
  }, [draw, cells]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  function screenToWorld(clientX: number, clientY: number) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const { x: camX, y: camY, zoom } = camera.current;
    const hexSize = sizeRef.current * zoom;
    const x = clientX - rect.left - w / 2 - camX;
    const y = clientY - rect.top - h / 2 - camY;
    return pixelToHex(x, y, hexSize);
  }

  function pickCell(clientX: number, clientY: number): HexCell | undefined {
    const h = screenToWorld(clientX, clientY);
    return cellsRef.current.get(hexKey(h));
  }

  function handlePointerDown(e: React.PointerEvent) {
    drag.current = { active: true, lx: e.clientX, ly: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (drag.current.active) {
      const dx = e.clientX - drag.current.lx;
      const dy = e.clientY - drag.current.ly;
      drag.current.lx = e.clientX;
      drag.current.ly = e.clientY;
      camera.current.x += dx;
      camera.current.y += dy;
      draw();
      return;
    }
    const cell = pickCell(e.clientX, e.clientY);
    if (!cell || cell.kind === "ocean") {
      setHoverLabel(null);
      return;
    }
    if (cell.territory) {
      setHoverLabel(
        `${cell.territory.name} · #${cell.territory.rank} · ${Math.round(cell.territory.territoryShare * 100)}%`,
      );
    } else if (cell.continentSlug) {
      const c = continentBySlug[cell.continentSlug];
      setHoverLabel(c ? `${c.continentName} · свободная земля` : null);
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const moved =
      Math.abs(e.clientX - drag.current.lx) + Math.abs(e.clientY - drag.current.ly);
    drag.current.active = false;
    if (moved > 6) return;

    const cell = pickCell(e.clientX, e.clientY);
    if (!cell || cell.kind === "ocean") {
      setSelected(null);
      return;
    }
    const continent = cell.continentSlug
      ? continentBySlug[cell.continentSlug]
      : undefined;
    if (!continent) return;

    if (cell.territory) {
      setSelected({ kind: "brand", territory: cell.territory, continent });
    } else {
      setSelected({ kind: "continent", continent });
    }
    draw();
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const next = Math.min(1.8, Math.max(0.35, camera.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    camera.current.zoom = next;
    draw();
  }

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[#0c1a22] shadow-[var(--shadow-soft)]"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            drag.current.active = false;
            setHoverLabel(null);
          }}
          onWheel={handleWheel}
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[11px] text-white/85 backdrop-blur-sm">
          Тяни · колесо — масштаб · клик — территория
        </div>
        {hoverLabel && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-md bg-black/55 px-3 py-1.5 text-center text-xs text-white backdrop-blur-sm">
            {hoverLabel}
          </div>
        )}
      </div>

      {selected?.kind === "brand" && (
        <div className="surface-card border-l-4 border-primary">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">
                {selected.continent.continentName}
              </p>
              <p className="font-display text-lg font-semibold text-ink">
                {selected.territory.name}
              </p>
              <p className="text-sm text-muted">
                #{selected.territory.rank} ·{" "}
                {Math.round(selected.territory.territoryShare * 100)}% территории
                {selected.territory.rankLabel ? ` · ${selected.territory.rankLabel}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/brand/${selected.territory.slug}`}
                className="btn-primary px-4 py-2 text-sm"
              >
                Карточка
              </Link>
              <Link
                href={`/category/${selected.continent.slug}`}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Материк
              </Link>
            </div>
          </div>
        </div>
      )}

      {selected?.kind === "continent" && (
        <div className="surface-card border-l-4" style={{ borderLeftColor: selected.continent.color }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-ink">
                {selected.continent.continentName}
              </p>
              <p className="text-sm text-muted">
                {selected.continent.name} · {selected.continent.brandCount} брендов
              </p>
            </div>
            <Link
              href={`/category/${selected.continent.slug}`}
              className="btn-primary px-4 py-2 text-sm"
            >
              Открыть материк
            </Link>
          </div>
        </div>
      )}

      {!compact && continents.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {continents.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-soft)] px-3 py-1.5 text-xs font-medium text-ink hover:bg-white"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: c.color }}
                />
                {locale === "kk" ? c.name : c.continentName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
