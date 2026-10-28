"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import type { MapContinent } from "@/components/HexWorldMap";
import { buildPlanet, type PlanetTerritory } from "@/lib/planet-grid";
import { ContinentPanel } from "@/components/ContinentPanel";
import { drawCategoryIcon, iconFor } from "@/lib/category-icons";

type Props = {
  continents: MapContinent[];
  locale?: string;
  height?: number;
  compact?: boolean;
  /** Controlled continent selection (by category slug). */
  selectedSlug?: string | null;
  onSelectSlug?: (slug: string | null) => void;
};

type ScreenTarget = {
  categoryIndex: number;
  x: number;
  y: number;
  radius: number;
  z: number;
};

type CellHit = {
  categoryIndex: number;
  x: number;
  y: number;
  size: number;
  z: number;
};

const SCROLL_HINT_KEY = "bw-planet-scroll-hint";

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seeded(seed: number) {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function parseColor(hex: string) {
  return parseInt(hex.replace("#", ""), 16) || 0x3aa77e;
}

function shadeHex(hex: string, factor: number) {
  const color = parseColor(hex);
  const r = Math.min(255, Math.max(0, ((color >> 16) & 255) * factor));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 255) * factor));
  const b = Math.min(255, Math.max(0, (color & 255) * factor));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function fibonacciCenters(count: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / Math.max(1, count - 1)) * 2;
    return {
      lat: Math.asin(y * 0.78),
      lon: index * golden + Math.sin(index * 1.7) * 0.32,
    };
  });
}

function project(
  lat: number,
  lon: number,
  rotation: number,
  tilt: number,
  cx: number,
  cy: number,
  radius: number,
) {
  const relativeLon = lon + rotation;
  const x0 = Math.cos(lat) * Math.sin(relativeLon);
  const y0 = Math.sin(lat);
  const z0 = Math.cos(lat) * Math.cos(relativeLon);
  const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
  const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
  return { x: cx + x0 * radius, y: cy - y * radius, z };
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function BrandPlanet({
  continents,
  locale = "ru",
  height = 620,
  compact = false,
  selectedSlug,
  onSelectSlug,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(-0.55);
  const tiltRef = useRef(-0.12);
  const dragRef = useRef({ active: false, x: 0, y: 0, moved: 0 });
  const targetsRef = useRef<ScreenTarget[]>([]);
  const cellHitsRef = useRef<CellHit[]>([]);
  const selectedIndexRef = useRef<number | null>(null);
  const pendingScrollRef = useRef(false);
  const scrollHintDoneRef = useRef(false);
  const [internalIndex, setInternalIndex] = useState<number | null>(null);
  const controlled = selectedSlug !== undefined;
  const selectedIndex = (() => {
    if (!controlled) return internalIndex;
    if (selectedSlug == null) return null;
    const idx = continents.findIndex((c) => c.slug === selectedSlug);
    return idx >= 0 ? idx : null;
  })();
  // Contiguous landmasses grown from seeds, not scattered markers: continents
  // meet at real borders and a brand's holdings form one connected shape.
  const planet = useMemo(
    () =>
      buildPlanet({
        continentCount: Math.max(1, continents.length),
        brandWeights: continents.map((continent) =>
          continent.territories.length > 0
            ? continent.territories.map((territory) =>
                Math.max(1, territory.cellCount ?? 1),
              )
            : [1],
        ),
        rows: 34,
        equatorCols: 54,
        landFraction: 0.66,
        seed: 11,
      }),
    [continents],
  );
  const cells = planet.territories;
  const centers = useMemo(() => fibonacciCenters(continents.length), [continents.length]);
  const selected = selectedIndex == null ? null : continents[selectedIndex];

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    if (!selected || !pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    // Panel mounts after state update — scroll once it exists.
    const id = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
    return () => window.clearTimeout(id);
  }, [selected]);

  useEffect(() => {
    let frameId = 0;
    let previous = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (now: number) => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (!dragRef.current.active && !reduceMotion) rotationRef.current += dt * 0.045;

      const width = wrap.clientWidth;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width * (compact ? 0.43 : 0.4), height * 0.43);

      const space = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.72);
      space.addColorStop(0, "#172b3a");
      space.addColorStop(0.5, "#071620");
      space.addColorStop(1, "#02070c");
      ctx.fillStyle = space;
      ctx.fillRect(0, 0, width, height);

      const starRandom = seeded(4011);
      ctx.fillStyle = "rgba(218,238,244,.7)";
      for (let i = 0; i < 85; i++) {
        const x = starRandom() * width;
        const y = starRandom() * height;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < (radius + 20) ** 2) continue;
        const size = starRandom() > 0.9 ? 2 : 1;
        ctx.fillRect(Math.round(x), Math.round(y), size, size);
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      const ocean = ctx.createRadialGradient(
        cx - radius * 0.32,
        cy - radius * 0.36,
        radius * 0.08,
        cx,
        cy,
        radius,
      );
      ocean.addColorStop(0, "#4eb8c3");
      ocean.addColorStop(0.47, "#17647b");
      ocean.addColorStop(1, "#082b3c");
      ctx.fillStyle = ocean;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      // Atmospheric latitude bands make the sphere read as a globe.
      ctx.strokeStyle = "rgba(179,235,234,.12)";
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        const y = cy + (i / 4) * radius;
        const rx = Math.sqrt(Math.max(0, radius ** 2 - (y - cy) ** 2));
        ctx.beginPath();
        ctx.ellipse(cx, y, rx, Math.max(3, rx * 0.12), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      const visibleCells: { cell: PlanetTerritory; point: ReturnType<typeof project> }[] = [];
      for (const cell of cells) {
        const point = project(
          cell.lat,
          cell.lon,
          rotationRef.current,
          tiltRef.current,
          cx,
          cy,
          radius,
        );
        if (point.z > -0.02) visibleCells.push({ cell, point });
      }
      visibleCells.sort((a, b) => a.point.z - b.point.z);

      const selectedNow = selectedIndexRef.current;
      const nextCellHits: CellHit[] = [];

      // Land first as solid tiles, then only the edges that mean something —
      // coastline against the ocean and borders between owners.
      for (const { cell, point } of visibleCells) {
        const continent = continents[cell.continentIndex];
        if (!continent) continue;
        const owner =
          cell.brandIndex < 0 ? null : continent.territories[cell.brandIndex];
        // Milder perspective than a true foreshortening: shrinking tiles at
        // the limb reopens the seams we are closing here.
        const perspective = 0.84 + point.z * 0.16;
        const cellSize = Math.max(2.6, radius * cell.size * 1.06 * perspective);
        const isSelected = selectedNow === cell.continentIndex;

        drawHex(ctx, point.x, point.y, cellSize * 1.08);
        ctx.fillStyle = shadeHex(
          owner?.color ?? continent.color,
          cell.shade *
            (owner ? 0.94 : 0.62) *
            (0.7 + point.z * 0.32) *
            (isSelected ? 1.28 : 1),
        );
        ctx.fill();

        if (isSelected) {
          drawHex(ctx, point.x, point.y, cellSize * 1.02);
          ctx.strokeStyle = "rgba(255,252,235,.88)";
          ctx.lineWidth = Math.max(1.1, cellSize * 0.18);
          ctx.stroke();
        }

        if (point.z > 0.05) {
          nextCellHits.push({
            categoryIndex: cell.continentIndex,
            x: point.x,
            y: point.y,
            size: cellSize,
            z: point.z,
          });
        }
      }

      // One glyph per cell, faint enough to read as texture: at this zoom the
      // labels only fit on a handful of continents, so the icon is what makes
      // the rest identifiable.
      for (const { cell, point } of visibleCells) {
        const perspective = 0.84 + point.z * 0.16;
        const cellSize = Math.max(2.6, radius * cell.size * 1.06 * perspective);
        if (cellSize < 5) continue;

        const continent = continents[cell.continentIndex];
        if (!continent) continue;

        ctx.globalAlpha = cell.brandIndex >= 0 ? 0.5 : 0.34;
        drawCategoryIcon(
          ctx,
          iconFor(continent.slug),
          point.x,
          point.y,
          cellSize * 1.15,
          "rgba(255,252,238,0.95)",
        );
        ctx.globalAlpha = 1;
      }

      for (const { cell, point } of visibleCells) {
        if (!cell.isCoast && !cell.isBorder) continue;
        const perspective = 0.84 + point.z * 0.16;
        const cellSize = Math.max(2.6, radius * cell.size * 1.06 * perspective);
        const isSelected = selectedNow === cell.continentIndex;
        drawHex(ctx, point.x, point.y, cellSize);
        if (cell.isCoast) {
          ctx.strokeStyle = isSelected
            ? "rgba(255,250,230,.9)"
            : "rgba(4,20,26,.62)";
          ctx.lineWidth = Math.max(0.7, cellSize * (isSelected ? 0.28 : 0.2));
        } else {
          // Only the owner boundary, and faintly — a stroke on every cell edge
          // reads as honeycomb rather than land.
          ctx.strokeStyle = isSelected
            ? "rgba(255,250,226,.55)"
            : "rgba(255,250,226,.22)";
          ctx.lineWidth = Math.max(0.4, cellSize * 0.05);
        }
        ctx.stroke();
      }

      const nextTargets: ScreenTarget[] = [];
      centers.forEach((center, categoryIndex) => {
        const point = project(
          center.lat,
          center.lon,
          rotationRef.current,
          tiltRef.current,
          cx,
          cy,
          radius,
        );
        if (point.z < 0.08) return;
        const continent = continents[categoryIndex];
        nextTargets.push({
          categoryIndex,
          x: point.x,
          y: point.y,
          radius: Math.max(18, radius * 0.09),
          z: point.z,
        });

        const occupied = continent.territories.slice(0, 4);
        occupied.forEach((territory, brandIndex) => {
          const angle = (brandIndex / Math.max(1, occupied.length)) * Math.PI * 2;
          const bx = point.x + Math.cos(angle) * radius * 0.045;
          const by = point.y + Math.sin(angle) * radius * 0.035;
          ctx.fillStyle = "#fff8d6";
          ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 8, 2, 10);
          ctx.fillStyle = continent.color;
          ctx.fillRect(Math.round(bx) + 1, Math.round(by) - 8, 8, 5);
        });

        if (point.z > 0.32 && (!compact || radius > 210)) {
          const isSelected = selectedNow === categoryIndex;
          ctx.font = `${isSelected ? 800 : 700} ${Math.max(9, radius * 0.035)}px ui-sans-serif, system-ui`;
          ctx.textAlign = "center";
          ctx.lineWidth = isSelected ? 4 : 3;
          ctx.strokeStyle = "rgba(2,9,13,.72)";
          ctx.strokeText(continent.name, point.x, point.y - radius * 0.075);
          ctx.fillStyle = isSelected ? "#ffffff" : "#f7fbf7";
          ctx.fillText(continent.name, point.x, point.y - radius * 0.075);
        }
      });
      targetsRef.current = nextTargets;
      cellHitsRef.current = nextCellHits;

      // Moving friendly transport around the equator.
      if (!reduceMotion) {
        const transportLon = now / 4200;
        const transport = project(
          0.12,
          transportLon,
          rotationRef.current,
          tiltRef.current,
          cx,
          cy,
          radius,
        );
        if (transport.z > 0) {
          ctx.save();
          ctx.translate(transport.x, transport.y);
          ctx.rotate(-0.16);
          ctx.fillStyle = "#fff4bd";
          ctx.beginPath();
          ctx.moveTo(11, 0);
          ctx.lineTo(-9, -5);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-9, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();

      const atmosphere = ctx.createRadialGradient(
        cx - radius * 0.28,
        cy - radius * 0.32,
        radius * 0.65,
        cx,
        cy,
        radius * 1.08,
      );
      atmosphere.addColorStop(0, "rgba(255,255,255,0)");
      atmosphere.addColorStop(0.78, "rgba(13,65,83,.03)");
      atmosphere.addColorStop(0.96, "rgba(77,203,216,.32)");
      atmosphere.addColorStop(1, "rgba(51,160,185,0)");
      ctx.fillStyle = atmosphere;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.07, 0, Math.PI * 2);
      ctx.fill();

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [cells, centers, compact, continents, height]);

  function pick(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Prefer an actual land hex under the finger — the whole continent is the
    // hit area, not just the label floating above its centre.
    const cellHit =
      cellHitsRef.current
        .filter((hit) => Math.hypot(hit.x - x, hit.y - y) <= hit.size * 1.35)
        .sort(
          (a, b) =>
            Math.hypot(a.x - x, a.y - y) / Math.max(1, a.size) -
              Math.hypot(b.x - x, b.y - y) / Math.max(1, b.size) ||
            b.z - a.z,
        )[0] ?? null;
    if (cellHit) return cellHit;

    return (
      targetsRef.current
        .filter((target) => Math.hypot(target.x - x, target.y - y) <= target.radius * 2.4)
        .sort((a, b) => b.z - a.z)[0] ?? null
    );
  }

  function selectContinent(categoryIndex: number | null) {
    if (onSelectSlug) {
      onSelectSlug(
        categoryIndex == null ? null : (continents[categoryIndex]?.slug ?? null),
      );
    } else {
      setInternalIndex(categoryIndex);
    }
    if (categoryIndex == null) return;

    // First click only: scroll to the dossier so newcomers learn the panel
    // lives under the globe. After that, selecting stays in place.
    if (scrollHintDoneRef.current) return;
    try {
      if (sessionStorage.getItem(SCROLL_HINT_KEY) === "1") {
        scrollHintDoneRef.current = true;
        return;
      }
      sessionStorage.setItem(SCROLL_HINT_KEY, "1");
    } catch {
      // Private mode — still hint once for this page load.
    }
    scrollHintDoneRef.current = true;
    pendingScrollRef.current = true;
  }

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[#02070c] shadow-[var(--shadow-soft)]"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          aria-label="Вращающаяся вымышленная планета категорий BrandWars"
          onPointerDown={(event) => {
            dragRef.current = {
              active: true,
              x: event.clientX,
              y: event.clientY,
              moved: 0,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!dragRef.current.active) return;
            const dx = event.clientX - dragRef.current.x;
            const dy = event.clientY - dragRef.current.y;
            rotationRef.current += dx * 0.006;
            tiltRef.current = Math.max(
              -0.55,
              Math.min(0.55, tiltRef.current - dy * 0.003),
            );
            dragRef.current.x = event.clientX;
            dragRef.current.y = event.clientY;
            dragRef.current.moved += Math.abs(dx) + Math.abs(dy);
          }}
          onPointerUp={(event) => {
            if (dragRef.current.moved < 8) {
              const target = pick(event.clientX, event.clientY);
              selectContinent(target?.categoryIndex ?? null);
            }
            dragRef.current.active = false;
          }}
          onPointerLeave={() => {
            dragRef.current.active = false;
          }}
        />

        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/75 backdrop-blur">
          живая планета · вращай · выбирай материк
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/45 px-2 py-1 text-[10px] text-white/65 backdrop-blur">
          1 клетка роста = 500 ₸
        </div>
      </div>

      {/* Full continent dossier: prices, capacity, outcome history and every
          participant with a one-click price to take their place. */}
      {selected && (
        <div ref={panelRef} className="scroll-mt-6">
          <ContinentPanel
            categorySlug={selected.slug}
            locale={locale}
            onClose={() => selectContinent(null)}
          />
        </div>
      )}

      {!compact && (
        <p className="text-center text-xs text-muted">
          {locale === "kk"
            ? "Материктің кез келген жерін басыңыз — төменде сипаттама ашылады"
            : "Нажмите на любую часть материка — снизу откроется описание"}
        </p>
      )}
    </div>
  );
}
