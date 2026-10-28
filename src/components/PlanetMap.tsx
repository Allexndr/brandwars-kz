"use client";

import { useEffect, useState } from "react";
import type { MapContinent } from "@/components/HexWorldMap";
import { BrandPlanet } from "@/components/BrandPlanet";
import { ContinentFinder } from "@/components/ContinentFinder";
import { CATEGORY_CATALOG } from "@/lib/category-catalog";

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

const BRAND_COLORS = [
  "#F97316",
  "#0EA5E9",
  "#22C55E",
  "#EAB308",
  "#EC4899",
  "#8B5CF6",
  "#14B8A6",
  "#EF4444",
];

function brandColor(slug: string) {
  const hash = [...slug].reduce((value, char) => value + char.charCodeAt(0), 0);
  return BRAND_COLORS[hash % BRAND_COLORS.length];
}

export function PlanetMap({ locale = "ru", height = 560, compact = false }: Props) {
  const [continents, setContinents] = useState<MapContinent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

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
              battlePower: number;
              color: string;
              websiteUrl?: string | null;
            }>;
            leaders?: Array<{
              slug: string;
              name: string;
              rank: number;
              territoryShare: number;
              battlePower: number;
            }>;
          }) => {
            const territories =
              cat.territories?.map((t) => ({
                id: t.id,
                slug: t.slug,
                name: t.name,
                territoryShare: t.territoryShare,
                rank: t.rank,
                battlePower: t.battlePower,
                cellCount: Math.max(1, 1 + Math.floor((t.battlePower - 1000) / 500)),
                color: brandColor(t.slug),
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
                battlePower: t.battlePower,
                cellCount: Math.max(1, 1 + Math.floor((t.battlePower - 1000) / 500)),
                color: brandColor(t.slug),
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
      } catch {
        if (!cancelled) {
          setContinents(
            CATEGORY_CATALOG.map((category) => ({
              slug: category.slug,
              name: locale === "kk" ? category.nameKk : category.nameRu,
              continentName:
                locale === "kk" ? category.continentKk : category.continentRu,
              color: category.color,
              brandCount: 0,
              territories: [],
            })),
          );
          setError(null);
        }
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
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(200px,240px)] lg:items-start">
      <BrandPlanet
        continents={continents}
        locale={locale}
        height={height}
        compact={compact}
        selectedSlug={selectedSlug}
        onSelectSlug={setSelectedSlug}
      />
      <div
        className="lg:sticky lg:top-4"
        style={{ minHeight: compact ? undefined : height }}
      >
        <ContinentFinder
          continents={continents}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
          locale={locale}
        />
      </div>
    </div>
  );
}
