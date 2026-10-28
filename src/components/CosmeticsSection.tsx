"use client";

import { useCallback, useEffect, useState } from "react";
import { CharacterStudio, type CharacterConfig } from "@/components/CharacterStudio";
import { formatApiError } from "@/lib/format-api-error";

type BrandRow = {
  claimId: string;
  claimStatus: string;
  name: string;
  slug: string | null;
  categorySlug: string | null;
  continent: string | null;
  rank: number | null;
  cellCount: number;
  clickCount: number;
  logoUrl: string | null;
  cosmetics: {
    representativeName: string | null;
    characterType: string | null;
    outfitColor: string | null;
  };
};

/**
 * Character setup, after payment.
 *
 * These fields used to sit in the checkout wizard, where every one of them cost
 * conversion without changing what the buyer receives. Here the money is
 * already in, so there is room to let someone actually enjoy dressing their
 * representative.
 */
export function CosmeticsSection() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [config, setConfig] = useState<CharacterConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/dashboard/brands", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { brands: [] }))
      .then((data: { brands: BrandRow[] }) => {
        if (!alive) return;
        setBrands(data.brands ?? []);
        if (data.brands?.length) setActiveId(data.brands[0].claimId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Memoised so CharacterStudio's onChange effect does not loop.
  const handleChange = useCallback((next: CharacterConfig) => {
    setConfig(next);
    setSaved(false);
  }, []);

  const active = brands.find((b) => b.claimId === activeId) ?? null;

  async function save() {
    if (!active || !config) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/brand-claims/${active.claimId}/cosmetics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          representativeName: config.representativeName || undefined,
          characterType: config.characterType,
          outfitColor: config.outfitColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error, "Не удалось сохранить"));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded || brands.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">
          Ваш персонаж на карте
        </h2>
        <p className="mt-1 text-sm text-muted">
          Палитра подбирается из логотипа автоматически. Имя проходит модерацию.
        </p>
      </div>

      {brands.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {brands.map((brand) => (
            <button
              key={brand.claimId}
              type="button"
              onClick={() => setActiveId(brand.claimId)}
              className={`rounded-brand px-3 py-1.5 text-sm font-medium transition ${
                activeId === brand.claimId
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-soft)] text-muted hover:text-ink"
              }`}
            >
              {brand.name}
              {brand.rank ? ` · #${brand.rank}` : ""}
            </button>
          ))}
        </div>
      )}

      {active && (
        <>
          {active.claimStatus !== "APPROVED" && (
            <p className="rounded-brand bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-ink">
              Бренд ещё на модерации. Персонажа можно настроить сейчас — он
              появится на карте вместе с подтверждением.
            </p>
          )}

          <CharacterStudio
            key={active.claimId}
            logoUrl={active.logoUrl}
            brandName={active.name}
            categorySlug={active.categorySlug ?? undefined}
            defaultName={active.cosmetics.representativeName ?? active.name}
            onChange={handleChange}
          />

          {error && (
            <p className="rounded-brand bg-[var(--color-surface-soft)] px-3 py-2 text-sm text-[var(--color-primary)]">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving || !config}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Сохраняем…" : saved ? "Сохранено" : "Сохранить персонажа"}
          </button>
        </>
      )}
    </section>
  );
}
