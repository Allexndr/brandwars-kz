"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/routing";

type ClashBrand = {
  brandId: string;
  brandSlug: string;
  brandName: string;
  rank: number;
  rankLabel: string;
  battlePower: number;
  territoryShare: number;
};

type Props = {
  categorySlug: string;
  categoryName: string;
  entries: ClashBrand[];
  locale?: string;
};

type Theme = {
  sky: string;
  ground: string;
  left: string;
  right: string;
  resource: "ticket" | "sparkle" | "packet" | "orb" | "coin" | "cube";
  leftBuilding: string;
  rightBuilding: string;
};

const THEMES: Record<string, Theme> = {
  travel: {
    sky: "#bfe3e4",
    ground: "#d9c78e",
    left: "#e97531",
    right: "#2a7b88",
    resource: "ticket",
    leftBuilding: "Аэропорт",
    rightBuilding: "Отель",
  },
  beauty: {
    sky: "#f2d5df",
    ground: "#d8b6c4",
    left: "#d94988",
    right: "#814e9e",
    resource: "sparkle",
    leftBuilding: "Салон",
    rightBuilding: "Бьюти-башня",
  },
  code: {
    sky: "#a8cad0",
    ground: "#657b68",
    left: "#287f73",
    right: "#405fad",
    resource: "packet",
    leftBuilding: "Серверная",
    rightBuilding: "Технопарк",
  },
  "ai-agents": {
    sky: "#b9d3df",
    ground: "#607489",
    left: "#198da5",
    right: "#7054b5",
    resource: "orb",
    leftBuilding: "Лаборатория",
    rightBuilding: "Дата-центр",
  },
  marketing: {
    sky: "#f0cfb5",
    ground: "#ba7655",
    left: "#c43f36",
    right: "#dd792f",
    resource: "coin",
    leftBuilding: "Медиа-центр",
    rightBuilding: "Студия",
  },
  games: {
    sky: "#c9bddf",
    ground: "#665783",
    left: "#744bd1",
    right: "#c64079",
    resource: "cube",
    leftBuilding: "Арена",
    rightBuilding: "Портал",
  },
};

const DEFAULT_THEME = THEMES.code;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function frontFromPower(left: number, right: number) {
  const total = Math.max(1, left + right);
  return clamp(50 + ((left - right) / total) * 35, 15, 85);
}

function formatPower(value: number) {
  return new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 0 }).format(value);
}

function drawPixelBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  mirrored = false,
) {
  const u = 4;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (mirrored) ctx.scale(-1, 1);
  ctx.fillStyle = "rgba(12,21,35,.25)";
  ctx.fillRect(-24, 18, 52, 6);
  ctx.fillStyle = "#152238";
  ctx.fillRect(-22, -26, 44, 46);
  ctx.fillStyle = color;
  ctx.fillRect(-18, -22, 36, 38);
  ctx.fillStyle = "#f5df91";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.fillRect(-13 + col * 11, -16 + row * 11, 6, 6);
    }
  }
  ctx.fillStyle = "#152238";
  ctx.fillRect(-5, 8, 10, 12);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-22, -34, u, 12);
  ctx.fillStyle = color;
  ctx.fillRect(-18, -34, 20, 9);
  ctx.restore();
}

function drawPixelUnit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  frame: number,
  facing: 1 | -1,
) {
  const u = 2;
  const bob = frame % 2;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y - bob));
  ctx.scale(facing, 1);
  ctx.fillStyle = "rgba(7,14,22,.28)";
  ctx.fillRect(-8, 11, 16, 3);
  ctx.fillStyle = "#19233a";
  ctx.fillRect(-6, -9, 12, 9);
  ctx.fillStyle = color;
  ctx.fillRect(-4, -7, 8, 7);
  ctx.fillStyle = "#ffd4a3";
  ctx.fillRect(-4, -15, 8, 7);
  ctx.fillStyle = "#19233a";
  ctx.fillRect(-5, -17, 10, 4);
  ctx.fillRect(-3, -12, u, u);
  ctx.fillRect(2, -12, u, u);
  const stride = frame % 4 < 2 ? 2 : -2;
  ctx.fillRect(-5 + stride, 0, 4, 10);
  ctx.fillRect(1 - stride, 0, 4, 10);
  ctx.restore();
}

function drawResource(
  ctx: CanvasRenderingContext2D,
  kind: Theme["resource"],
  x: number,
  y: number,
  color: string,
  rotation: number,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(rotation);
  ctx.fillStyle = "#172238";
  if (kind === "ticket") {
    ctx.fillRect(-8, -5, 16, 10);
    ctx.fillStyle = "#f8df75";
    ctx.fillRect(-6, -3, 12, 6);
  } else if (kind === "packet") {
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = color;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = "#bfeeff";
    ctx.fillRect(-2, -2, 4, 4);
  } else if (kind === "sparkle") {
    ctx.fillStyle = "#fff0ac";
    ctx.fillRect(-2, -8, 4, 16);
    ctx.fillRect(-8, -2, 16, 4);
  } else if (kind === "orb") {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#e8fbff";
    ctx.fillRect(-2, -2, 4, 4);
  } else if (kind === "coin") {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#f5c84c";
    ctx.fill();
    ctx.fillStyle = "#9b5b1c";
    ctx.fillRect(-1, -4, 2, 8);
  } else {
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = color;
    ctx.fillRect(-5, -5, 10, 10);
  }
  ctx.restore();
}

export function BorderClashWidget({
  categorySlug,
  categoryName,
  entries,
  locale = "ru",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [liveEntries, setLiveEntries] = useState(entries);
  const frontRef = useRef(50);
  const theme = THEMES[categorySlug] ?? DEFAULT_THEME;
  const top = liveEntries.slice(0, 5);
  const left = top[0];
  const right = top[1];

  const targetFront = useMemo(
    () => frontFromPower(left?.battlePower ?? 1, right?.battlePower ?? 1),
    [left?.battlePower, right?.battlePower],
  );

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/map/categories/${categorySlug}?locale=${locale}`);
        if (!res.ok) return;
        const data = await res.json();
        setLiveEntries(
          (data.territories ?? []).map(
            (item: {
              brandId: string;
              slug: string;
              name: string;
              rank: number;
              rankLabel: string;
              battlePower: number;
              territoryShare: number;
            }) => ({
              brandId: item.brandId,
              brandSlug: item.slug,
              brandName: item.name,
              rank: item.rank,
              rankLabel: item.rankLabel,
              battlePower: item.battlePower,
              territoryShare: item.territoryShare,
            }),
          ),
        );
      } catch {
        // Keep the latest visible state.
      }
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [categorySlug, locale]);

  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    let previous = performance.now();
    let eventTimer = 0;

    const draw = (now: number) => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const t = (now - start) / 1000;
      frontRef.current += (targetFront - frontRef.current) * Math.min(1, dt * 1.3);

      const width = wrap.clientWidth;
      const height = 380;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      const frontX = (width * frontRef.current) / 100;
      const horizon = 190;
      ctx.fillStyle = theme.sky;
      ctx.fillRect(0, 0, width, horizon);
      ctx.fillStyle = theme.ground;
      ctx.fillRect(0, horizon, width, height - horizon);

      // Territory tint split follows front position.
      ctx.fillStyle = `${theme.left}35`;
      ctx.fillRect(0, horizon, frontX, height - horizon);
      ctx.fillStyle = `${theme.right}35`;
      ctx.fillRect(frontX, horizon, width - frontX, height - horizon);

      // Pixel clouds.
      ctx.fillStyle = "rgba(255,255,255,.55)";
      for (let i = 0; i < 4; i++) {
        const cloudX = ((i * 263 + t * (7 + i)) % (width + 140)) - 70;
        const cloudY = 32 + (i % 2) * 38;
        ctx.fillRect(Math.round(cloudX), cloudY, 52, 12);
        ctx.fillRect(Math.round(cloudX + 12), cloudY - 8, 28, 8);
      }

      // Moving border: safe, non-destructive "attention line".
      ctx.strokeStyle = "#fff4bd";
      ctx.lineWidth = 4;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -t * 14;
      ctx.beginPath();
      for (let y = horizon - 18; y <= height; y += 8) {
        const x = frontX + Math.sin(y * 0.07 + t * 2.1) * 7;
        if (y === horizon - 18) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      drawPixelBuilding(ctx, Math.max(62, width * 0.14), horizon + 45, theme.left);
      drawPixelBuilding(
        ctx,
        Math.min(width - 62, width * 0.86),
        horizon + 45,
        theme.right,
        true,
      );

      const frame = Math.floor(t * 7);
      const unitCount = width < 560 ? 3 : 5;
      for (let i = 0; i < unitCount; i++) {
        const y = horizon + 95 + (i % 3) * 48;
        const lx = Math.min(frontX - 25, width * 0.24 + i * 21);
        const rx = Math.max(frontX + 25, width * 0.76 - i * 21);
        drawPixelUnit(ctx, lx, y, theme.left, frame + i, 1);
        drawPixelUnit(ctx, rx, y + 10, theme.right, frame + i + 2, -1);
      }

      // Alternating resource exchange every few seconds.
      const cycle = t % 6;
      const direction = Math.floor(t / 6) % 2 === 0 ? 1 : -1;
      const progress = cycle / 6;
      const fromX = direction === 1 ? width * 0.27 : width * 0.73;
      const toX = direction === 1 ? width * 0.73 : width * 0.27;
      const resourceX = fromX + (toX - fromX) * progress;
      const resourceY = horizon + 58 - Math.sin(progress * Math.PI) * 90;
      drawResource(
        ctx,
        theme.resource,
        resourceX,
        resourceY,
        direction === 1 ? theme.left : theme.right,
        t * direction * 2,
      );

      // Friendly burst when a resource crosses the attention line.
      if (Math.abs(resourceX - frontX) < 16 && now - eventTimer > 900) {
        eventTimer = now;
      }
      if (now - eventTimer < 500) {
        const pulse = (now - eventTimer) / 500;
        ctx.strokeStyle = `rgba(255,244,189,${1 - pulse})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(frontX, horizon + 30, 12 + pulse * 34, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(8,18,28,.78)";
      ctx.fillRect(0, height - 34, width, 34);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "600 12px ui-monospace, SFMono-Regular, monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `${left?.brandName ?? "Свободная сторона"}  ${frontRef.current.toFixed(1)}%  ↔  ${(100 - frontRef.current).toFixed(1)}%  ${right?.brandName ?? "Свободная сторона"}`,
        width / 2,
        height - 13,
      );

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [left?.brandName, right?.brandName, targetFront, theme]);

  if (!left || !right) {
    return (
      <section className="surface-card overflow-hidden p-0">
        <div className="bg-[#10202a] px-6 py-12 text-center text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">{categoryName}</p>
          <h2 className="mt-3 font-display text-2xl font-semibold">
            Для линии внимания нужны два бренда
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
            Станьте первым участником — следующий бренд откроет живую границу.
          </p>
          <Link href="/claim-brand" className="btn-primary mt-6">
            Занять территорию
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] bg-[#10202a] shadow-[var(--shadow-soft)]">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/10 px-4 py-4 text-white md:px-6">
        <div className="min-w-0">
          <p className="truncate font-semibold">{left.brandName}</p>
          <p className="text-xs text-white/55">
            #{left.rank} · {formatPower(left.battlePower)} силы
          </p>
        </div>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f4c85f]">
            Линия внимания
          </p>
          <p className="mt-1 text-xs text-white/55">{categoryName}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate font-semibold">{right.brandName}</p>
          <p className="text-xs text-white/55">
            #{right.rank} · {formatPower(right.battlePower)} силы
          </p>
        </div>
      </header>

      <div ref={wrapRef} className="relative h-[380px]">
        <canvas ref={canvasRef} className="pixelated h-full w-full" aria-label="Анимированная линия внимания двух брендов" />
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/45 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/75">
          live · ресурсы движутся автоматически
        </div>
        <span className="pointer-events-none absolute bottom-12 left-3 rounded bg-black/40 px-2 py-1 text-[10px] text-white/70">
          {theme.leftBuilding}
        </span>
        <span className="pointer-events-none absolute bottom-12 right-3 rounded bg-black/40 px-2 py-1 text-[10px] text-white/70">
          {theme.rightBuilding}
        </span>
      </div>

      <div className="grid gap-3 border-t border-white/10 p-4 sm:grid-cols-2 md:p-5">
        <Link
          href={`/dashboard?brandId=${left.brandId}&topUp=500`}
          className="inline-flex items-center justify-between rounded-brand bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[#fff5dc]"
        >
          <span>Поддержать {left.brandName}</span>
          <span aria-hidden>+ ₸</span>
        </Link>
        <Link
          href={`/dashboard?brandId=${right.brandId}&topUp=500`}
          className="inline-flex items-center justify-between rounded-brand bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[#fff5dc]"
        >
          <span>Поддержать {right.brandName}</span>
          <span aria-hidden>+ ₸</span>
        </Link>
      </div>

      <div className="border-t border-white/10 px-4 py-4 md:px-6">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Топ-5</span>
          <span>игровая метрика BrandWars</span>
        </div>
        <ol className="mt-3 grid gap-2 md:grid-cols-5">
          {top.map((entry) => (
            <li
              key={entry.brandSlug}
              className="flex items-center justify-between rounded bg-white/5 px-3 py-2 text-xs text-white"
            >
              <span className="mr-2 text-[#f4c85f]">#{entry.rank}</span>
              <span className="min-w-0 flex-1 truncate">{entry.brandName}</span>
              <span className="ml-2 text-white/45">{formatPower(entry.battlePower)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
