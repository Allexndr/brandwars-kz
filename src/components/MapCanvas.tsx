"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@/i18n/routing";

type Territory = {
  id: string;
  slug: string;
  name: string;
  territoryShare: number;
  rank: number;
  color: string;
  gridIndex: number;
  rankLabel: string;
  websiteUrl?: string | null;
};

type CategoryMapProps = {
  categorySlug: string;
  locale?: string;
};

export function CategoryMap({ categorySlug, locale = "ru" }: CategoryMapProps) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [selected, setSelected] = useState<Territory | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/map/categories/${categorySlug}?locale=${locale}`,
      );
      const data = await res.json();
      if (res.ok) {
        setTerritories(data.territories ?? []);
        setCategoryName(
          locale === "kk" ? data.category?.nameKk : data.category?.nameRu,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [categorySlug, locale]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 45_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="surface-card flex h-[480px] items-center justify-center">
        <p className="text-muted">Загрузка карты...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-ink">{categoryName}</h2>
      <MapCanvas
        territories={territories}
        categorySlug={categorySlug}
        onSelect={setSelected}
      />
      {selected && (
        <div className="surface-card border-l-4 border-primary">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-ink">{selected.name}</p>
              <p className="text-sm text-muted">
                #{selected.rank} · {Math.round(selected.territoryShare * 100)}% ·{" "}
                {selected.rankLabel}
              </p>
            </div>
            <Link href={`/brand/${selected.slug}`} className="btn-primary px-4 py-2 text-sm">
              Карточка
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

type MapCanvasProps = {
  territories: Territory[];
  categorySlug: string;
  onSelect?: (t: Territory) => void;
  overview?: boolean;
};

export function MapCanvas({
  territories,
  categorySlug,
  onSelect,
  overview = false,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      if (!containerRef.current || !canvasRef.current) return;

      const PIXI = await import("pixi.js");
      if (destroyed) return;

      appRef.current?.destroy();

      const app = new PIXI.Application();
      await app.init({
        canvas: canvasRef.current,
        width: containerRef.current.clientWidth,
        height: overview ? 360 : 480,
        backgroundColor: 0x0f172a,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      appRef.current = app;

      const cols = overview ? 3 : Math.max(2, Math.ceil(Math.sqrt(territories.length || 1)));
      const cellW = app.screen.width / cols;
      const cellH = app.screen.height / Math.ceil((territories.length || 1) / cols);

      territories.forEach((t, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const size = Math.min(cellW, cellH) * (0.3 + t.territoryShare * 0.7);

        const g = new PIXI.Graphics();
        const color = parseInt(t.color.replace("#", ""), 16) || 0x38bdf8;
        g.roundRect(
          col * cellW + (cellW - size) / 2,
          row * cellH + (cellH - size) / 2,
          size,
          size,
          8,
        );
        g.fill({ color, alpha: 0.85 });
        g.stroke({ color: 0xffffff, width: t.rank === 1 ? 3 : 1, alpha: 0.3 });
        g.eventMode = "static";
        g.cursor = "pointer";
        g.on("pointertap", () => onSelect?.(t));
        app.stage.addChild(g);

        if (t.rank === 1) {
          const highlight = new PIXI.Graphics();
          highlight.roundRect(
            col * cellW + (cellW - size) / 2 - 4,
            row * cellH + (cellH - size) / 2 - 4,
            size + 8,
            size + 8,
            10,
          );
          highlight.stroke({ color: 0xfacc15, width: 2, alpha: 0.8 });
          app.stage.addChildAt(highlight, 0);
        }
      });

      if (territories.length === 0) {
        const text = new PIXI.Text({
          text: overview ? categorySlug : "Нет брендов на карте",
          style: { fill: 0x94a3b8, fontSize: 16 },
        });
        text.x = app.screen.width / 2 - text.width / 2;
        text.y = app.screen.height / 2 - text.height / 2;
        app.stage.addChild(text);
      }
    }

    init();

    return () => {
      destroyed = true;
      appRef.current?.destroy();
      appRef.current = null;
    };
  }, [territories, categorySlug, onSelect, overview]);

  return (
    <div
      ref={containerRef}
      className="pixelated surface-card w-full overflow-hidden p-0"
    >
      <canvas ref={canvasRef} className="w-full" />
    </div>
  );
}
