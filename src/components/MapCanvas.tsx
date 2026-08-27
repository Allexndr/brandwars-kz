"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { HexWorldMap, type MapContinent, type MapTerritory } from "@/components/HexWorldMap";

type Props = {
  categorySlug: string;
  locale?: string;
};

function rankLabel(rank: number, locale: string): string {
  if (rank === 1) {
    return locale === "kk" ? "Санат лидері" : "Лидер BrandWars в категории";
  }
  if (rank <= 3) return locale === "kk" ? "Үлкен держава" : "Великая держава";
  if (rank <= 10) return locale === "kk" ? "Үміткер" : "Претендент";
  return locale === "kk" ? "Жаңадан келген" : "Новичок";
}

export function CategoryMap({ categorySlug, locale = "ru" }: Props) {
  const [continent, setContinent] = useState<MapContinent | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/map/categories/${categorySlug}?locale=${locale}`);
      const data = await res.json();
      if (!res.ok) return;

      const territories: MapTerritory[] = (data.territories ?? []).map(
        (t: {
          id?: string;
          slug: string;
          name: string;
          territoryShare: number;
          rank: number;
          color?: string;
          websiteUrl?: string | null;
        }) => ({
          id: t.id ?? `${categorySlug}-${t.slug}`,
          slug: t.slug,
          name: t.name,
          territoryShare: t.territoryShare,
          rank: t.rank,
          color: t.color || data.category?.color || "#0d9488",
          rankLabel: rankLabel(t.rank, locale),
          websiteUrl: t.websiteUrl,
          categorySlug,
        }),
      );

      setContinent({
        slug: categorySlug,
        name: locale === "kk" ? data.category?.nameKk : data.category?.nameRu,
        continentName:
          locale === "kk" ? data.category?.continentKk : data.category?.continentRu,
        color: data.category?.color || "#0d9488",
        brandCount: territories.length,
        territories,
      });
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

  if (!continent) {
    return (
      <div className="surface-card flex h-[320px] flex-col items-center justify-center gap-3">
        <p className="text-muted">Материк пока пуст</p>
        <Link href="/claim-brand" className="btn-primary text-sm">
          Занять территорию
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            {continent.continentName}
          </h2>
          <p className="text-sm text-muted">{continent.name}</p>
        </div>
        <Link href="/map" className="btn-secondary px-4 py-2 text-sm">
          Вся планета
        </Link>
      </div>
      <HexWorldMap continents={[continent]} locale={locale} height={520} />
    </div>
  );
}
