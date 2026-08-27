"use client";

import { useEffect, useState } from "react";
import { HexWorldMap, type MapContinent } from "@/components/HexWorldMap";

type Props = {
  locale?: string;
  height?: number;
  compact?: boolean;
};

function rankLabel(rank: number, locale: string): string {
  if (rank === 1) {
    return locale === "kk" ? "Санат лидері" : "Лидер BrandWars в категории";
  }
  if (rank <= 3) return locale === "kk" ? "Үлкен держава" : "Великая держава";
  if (rank <= 10) return locale === "kk" ? "Үміткер" : "Претендент";
  return locale === "kk" ? "Жаңадан келген" : "Новичок";
}

export function PlanetMap({ locale = "ru", height = 560, compact = false }: Props) {
  const [continents, setContinents] = useState<MapContinent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/map?full=1&locale=${locale}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "map error");
        if (cancelled) return;

        const mapped: MapContinent[] = (data.categories ?? []).map(
          (cat: {
            slug: string;
            nameRu: string;
            nameKk: string;
            continentRu: string;
            continentKk: string;
            color: string;
            brandCount: number;
            territories?: Array<{
              id: string;
              slug: string;
              name: string;
              territoryShare: number;
              rank: number;
              color: string;
              websiteUrl?: string | null;
            }>;
            leaders?: Array<{
              slug: string;
              name: string;
              rank: number;
              territoryShare: number;
            }>;
          }) => {
            const territories =
              cat.territories?.map((t) => ({
                id: t.id,
                slug: t.slug,
                name: t.name,
                territoryShare: t.territoryShare,
                rank: t.rank,
                color: t.color || cat.color,
                rankLabel: rankLabel(t.rank, locale),
                websiteUrl: t.websiteUrl,
                categorySlug: cat.slug,
              })) ??
              (cat.leaders ?? []).map((t) => ({
                id: `${cat.slug}-${t.slug}`,
                slug: t.slug,
                name: t.name,
                territoryShare: t.territoryShare,
                rank: t.rank,
                color: cat.color,
                rankLabel: rankLabel(t.rank, locale),
                categorySlug: cat.slug,
              }));

            return {
              slug: cat.slug,
              name: locale === "kk" ? cat.nameKk : cat.nameRu,
              continentName: locale === "kk" ? cat.continentKk : cat.continentRu,
              color: cat.color,
              brandCount: cat.brandCount,
              territories,
            };
          },
        );
        setContinents(mapped);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [locale]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center rounded-[var(--radius-lg)] bg-[#0c1a22] text-sm text-white/70"
        style={{ height }}
      >
        Загрузка планеты...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-[var(--radius-lg)] bg-[#0c1a22] text-sm text-red-300"
        style={{ height }}
      >
        Не удалось загрузить карту
      </div>
    );
  }

  return (
    <HexWorldMap
      continents={continents}
      locale={locale}
      height={height}
      compact={compact}
    />
  );
}
