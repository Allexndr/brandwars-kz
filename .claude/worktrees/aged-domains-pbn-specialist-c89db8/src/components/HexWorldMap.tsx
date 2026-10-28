"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import {
  hexKey,
  hexNeighbor,
  hexPolygonPoints,
  hexSpiral,
  hexToPixel,
  pixelToHex,
  hashHex,
  type Hex,
} from "@/lib/hex";
import {
  drawClashBurst,
  drawPixelCrown,
  drawPixelDude,
  drawPixelFlag,
  drawPixelKeep,
  drawPixelTree,
} from "@/lib/pixel-sprites";

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

type Unit = {
  id: string;
  q: number;
  r: number;
  tq: number;
  tr: number;
  progress: number;
  color: number;
  accent: number;
  leader: boolean;
  brandId?: string;
  facing: 1 | -1;
  speed: number;
};

type Clash = { x: number; y: number; a: number; b: number; until: number };

type Props = {
  continents: MapContinent[];
  locale?: string;
  height?: number;
  compact?: boolean;
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
    const claimed = new Set<string>();
    const sorted = [...continent.territories].sort(
      (a, b) => b.territoryShare - a.territoryShare,
    );
    let cursor = 0;

    for (const t of sorted) {
      const share = Math.max(0.08, t.territoryShare);
      const count = Math.max(1, Math.round(share * land.length));
      for (let i = 0; i < count && cursor < land.length; i++) {
        const h = land[cursor++];
        const key = hexKey(h);
        claimed.add(key);
        cells.set(key, {
          hex: h,
          kind: "brand",
          continentSlug: continent.slug,
          territory: t,
          fill: shade(parseColor(t.color || continent.color, base), 0.85 + hashHex(h) * 0.25),
          stroke: shade(base, 0.45),
        });
      }
    }

    for (const h of land) {
      const key = hexKey(h);
      if (claimed.has(key)) continue;
      cells.set(key, {
        hex: h,
        kind: "land",
        continentSlug: continent.slug,
        fill: shade(LAND_EMPTY, 0.9 + hashHex(h) * 0.2),
        stroke: shade(base, 0.35),
      });
    }
  });

  return cells;
}

function spawnUnits(cells: Map<string, HexCell>): Unit[] {
  const units: Unit[] = [];
  const brandHexes = [...cells.values()].filter((c) => c.kind === "brand" && c.territory);
  const byBrand = new Map<string, HexCell[]>();
  for (const c of brandHexes) {
    const id = c.territory!.id;
    const list = byBrand.get(id) ?? [];
    list.push(c);
    byBrand.set(id, list);
  }

  let n = 0;
  for (const [brandId, hexes] of byBrand) {
    const t = hexes[0].territory!;
    const color = parseColor(t.color);
    const count = t.rank === 1 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const home = hexes[i % hexes.length].hex;
      units.push({
        id: `${brandId}-${n++}`,
        q: home.q,
        r: home.r,
        tq: home.q,
        tr: home.r,
        progress: Math.random(),
        color,
        accent: shade(color, 1.35),
        leader: t.rank === 1 && i === 0,
        brandId,
        facing: Math.random() > 0.5 ? 1 : -1,
        speed: 0.35 + Math.random() * 0.45,
      });
    }
  }

  // Neutral scouts on empty land
  const land = [...cells.values()].filter((c) => c.kind === "land");
  for (const c of land.slice(0, 8)) {
    units.push({
      id: `scout-${n++}`,
      q: c.hex.q,
      r: c.hex.r,
      tq: c.hex.q,
      tr: c.hex.r,
      progress: Math.random(),
      color: 0x88c478,
      accent: 0xffd658,
      leader: false,
      facing: 1,
      speed: 0.25,
    });
  }
  return units;
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
  const selectedRef = useRef<Selected>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const camera = useRef({ x: 0, y: 0, zoom: compact ? 0.7 : 0.95 });
  const drag = useRef({ active: false, lx: 0, ly: 0, sx: 0, sy: 0 });
  const cellsRef = useRef<Map<string, HexCell>>(new Map());
  const unitsRef = useRef<Unit[]>([]);
  const clashesRef = useRef<Clash[]>([]);
  const sizeRef = useRef(20);
  const timeRef = useRef(0);

  const cells = useMemo(() => buildCells(continents), [continents]);
  cellsRef.current = cells;

  const continentBySlug = useMemo(
    () => Object.fromEntries(continents.map((c) => [c.slug, c])),
    [continents],
  );

  useEffect(() => {
    unitsRef.current = spawnUnits(cells);
  }, [cells]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      timeRef.current += dt;
      stepUnits(dt, now / 1000);
      paint();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, continents]);

  function pickNeighbor(unit: Unit): Hex {
    const origin = { q: unit.tq, r: unit.tr };
    const options: Hex[] = [];
    for (let i = 0; i < 6; i++) {
      const n = hexNeighbor(origin, i);
      const cell = cellsRef.current.get(hexKey(n));
      if (!cell || cell.kind === "ocean") continue;
      if (unit.brandId && cell.territory && cell.territory.id !== unit.brandId) {
        // border — still allowed, triggers clash
        options.push(n);
        continue;
      }
      options.push(n);
    }
    if (!options.length) return origin;
    return options[Math.floor(Math.random() * options.length)];
  }

  function stepUnits(dt: number, t: number) {
    const cells = cellsRef.current;
    for (const u of unitsRef.current) {
      u.progress += u.speed * dt;
      if (u.progress >= 1) {
        u.q = u.tq;
        u.r = u.tr;
        const next = pickNeighbor(u);
        if (next.q !== u.q) u.facing = next.q > u.q ? 1 : -1;
        u.tq = next.q;
        u.tr = next.r;
        u.progress = 0;

        const here = cells.get(hexKey({ q: u.q, r: u.r }));
        const there = cells.get(hexKey(next));
        if (
          here?.territory &&
          there?.territory &&
          here.territory.id !== there.territory.id
        ) {
          clashesRef.current.push({
            x: (here.hex.q + there.hex.q) / 2,
            y: (here.hex.r + there.hex.r) / 2,
            a: parseColor(here.territory.color),
            b: parseColor(there.territory.color),
            until: t + 0.9,
          });
        }
      }
    }
    clashesRef.current = clashesRef.current.filter((c) => c.until > t);
  }

  function paint() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = height;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const t = timeRef.current;
    const { x: camX, y: camY, zoom } = camera.current;
    const hexSize = sizeRef.current * zoom;
    const selectedNow = selectedRef.current;
    const selectedId =
      selectedNow?.kind === "brand"
        ? selectedNow.territory.id
        : selectedNow?.continent.slug;

    ctx.fillStyle = "#07141c";
    ctx.fillRect(0, 0, w, h);

    const toScreen = (hx: Hex) => {
      const p = hexToPixel(hx, hexSize);
      return { x: p.x + w / 2 + camX, y: p.y + h / 2 + camY };
    };

    for (const cell of cellsRef.current.values()) {
      const { x: cx, y: cy } = toScreen(cell.hex);
      if (cx < -50 || cy < -50 || cx > w + 50 || cy > h + 50) continue;

      let fill = cell.fill;
      if (cell.kind === "ocean") {
        const wave = 0.92 + 0.08 * Math.sin(t * 1.6 + cell.hex.q * 0.4 + cell.hex.r * 0.3);
        fill = shade(cell.fill, wave);
      }

      const pts = hexPolygonPoints(cx, cy, hexSize * 0.96);
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      ctx.fillStyle = `#${fill.toString(16).padStart(6, "0")}`;
      ctx.fill();

      const isSel =
        (cell.territory && cell.territory.id === selectedId) ||
        (selectedNow?.kind === "continent" && cell.continentSlug === selectedId);
      ctx.strokeStyle = isSel ? "#f8fafc" : `#${cell.stroke.toString(16).padStart(6, "0")}`;
      ctx.lineWidth = isSel ? 2 : cell.kind === "brand" ? 1 : 0.5;
      ctx.stroke();

      // checkerboard pixel texture on land
      if (cell.kind !== "ocean" && zoom > 0.55) {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        const u = Math.max(2, Math.round(hexSize / 8));
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            if ((i + j + cell.hex.q) % 2 === 0) {
              ctx.fillRect(Math.round(cx + i * u), Math.round(cy + j * u), u, u);
            }
          }
        }
      }

      if (cell.kind === "land" && hashHex(cell.hex) > 0.72 && zoom > 0.5) {
        drawPixelTree(ctx, cx, cy + hexSize * 0.1, hexSize / 10);
      }

      if (cell.territory?.rank === 1 && zoom > 0.5) {
        drawPixelKeep(ctx, cx, cy + 4, hexSize / 9, parseColor(cell.territory.color));
        drawPixelFlag(
          ctx,
          cx + hexSize * 0.25,
          cy - hexSize * 0.15,
          hexSize / 10,
          parseColor(cell.territory.color),
          t,
        );
      }
    }

    // Clash sparks at borders
    for (const clash of clashesRef.current) {
      const p = toScreen({ q: clash.x, r: clash.y });
      drawClashBurst(ctx, p.x, p.y, t, clash.a, clash.b);
    }

    // Units
    const frame = Math.floor(t * 8);
    for (const u of unitsRef.current) {
      const from = hexToPixel({ q: u.q, r: u.r }, hexSize);
      const to = hexToPixel({ q: u.tq, r: u.tr }, hexSize);
      const x = from.x + (to.x - from.x) * u.progress + w / 2 + camX;
      const y = from.y + (to.y - from.y) * u.progress + h / 2 + camY;
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      const scale = Math.max(1.4, hexSize / 11);
      drawPixelDude(ctx, x, y, scale, u.color, u.accent, frame + u.id.length, u.facing);
      if (u.leader) drawPixelCrown(ctx, x, y, scale);
    }

    if (zoom > 0.45) {
      continents.forEach((c, i) => {
        const center =
          continents.length === 1
            ? { q: 0, r: 0 }
            : CONTINENT_CENTERS[i % CONTINENT_CENTERS.length];
        const p = toScreen(center);
        ctx.font = `700 ${Math.max(12, 13 * zoom)}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(8,16,22,0.55)";
        ctx.fillText(c.continentName || c.name, p.x + 1, p.y - hexSize * 3.4 + 1);
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(c.continentName || c.name, p.x, p.y - hexSize * 3.4);
      });
    }
  }

  function screenToWorld(clientX: number, clientY: number) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const hexSize = sizeRef.current * camera.current.zoom;
    const x = clientX - rect.left - rect.width / 2 - camera.current.x;
    const y = clientY - rect.top - rect.height / 2 - camera.current.y;
    return pixelToHex(x, y, hexSize);
  }

  function pickCell(clientX: number, clientY: number) {
    return cellsRef.current.get(hexKey(screenToWorld(clientX, clientY)));
  }

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[#07141c] shadow-[var(--shadow-soft)]"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="pixelated h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(e) => {
            drag.current = {
              active: true,
              lx: e.clientX,
              ly: e.clientY,
              sx: e.clientX,
              sy: e.clientY,
            };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current.active) {
              camera.current.x += e.clientX - drag.current.lx;
              camera.current.y += e.clientY - drag.current.ly;
              drag.current.lx = e.clientX;
              drag.current.ly = e.clientY;
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
              setHoverLabel(c ? `${c.continentName}` : null);
            }
          }}
          onPointerUp={(e) => {
            const moved =
              Math.abs(e.clientX - drag.current.sx) + Math.abs(e.clientY - drag.current.sy);
            drag.current.active = false;
            if (moved > 8) return;
            const cell = pickCell(e.clientX, e.clientY);
            if (!cell || cell.kind === "ocean") {
              setSelected(null);
              return;
            }
            const continent = cell.continentSlug
              ? continentBySlug[cell.continentSlug]
              : undefined;
            if (!continent) return;
            setSelected(
              cell.territory
                ? { kind: "brand", territory: cell.territory, continent }
                : { kind: "continent", continent },
            );
          }}
          onPointerLeave={() => {
            drag.current.active = false;
            setHoverLabel(null);
          }}
          onWheel={(e) => {
            e.preventDefault();
            camera.current.zoom = Math.min(
              2,
              Math.max(0.4, camera.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)),
            );
          }}
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white/90">
          Пиксельная война · тяни карту · клик — территория
        </div>
        {hoverLabel && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-md bg-black/60 px-3 py-1.5 text-center text-xs text-white">
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
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/brand/${selected.territory.slug}`} className="btn-primary px-4 py-2 text-sm">
                Карточка
              </Link>
              <Link href={`/category/${selected.continent.slug}`} className="btn-secondary px-4 py-2 text-sm">
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
            <Link href={`/category/${selected.continent.slug}`} className="btn-primary px-4 py-2 text-sm">
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
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {locale === "kk" ? c.name : c.continentName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
