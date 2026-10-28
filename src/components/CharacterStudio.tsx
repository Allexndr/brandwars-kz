"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COSTUMES,
  DEFAULT_COSTUME,
  costumeFor,
  drawCharacter,
  type Costume,
} from "@/lib/character-sprites";
import {
  costumeFromSingleColor,
  deriveCostume,
  dominantColors,
  rgbToHex,
  type Rgb,
} from "@/lib/palette";

export type CharacterConfig = {
  representativeName: string;
  characterType: string;
  outfitColor: string;
  /** Full costume, so headwear and prop survive a round trip. */
  costume: Costume;
};

type Props = {
  /** Brand logo or favicon; its palette seeds the outfit automatically. */
  logoUrl?: string | null;
  brandName?: string;
  categorySlug?: string;
  defaultName?: string;
  onChange?: (config: CharacterConfig) => void;
};

const HEAD_OPTIONS: { value: Costume["head"]; label: string }[] = [
  { value: "none", label: "Без головного" },
  { value: "cap", label: "Кепка" },
  { value: "hood", label: "Капюшон" },
  { value: "helmet", label: "Шлем" },
  { value: "band", label: "Лента" },
  { value: "tophat", label: "Цилиндр" },
  { value: "visor", label: "Визор" },
];

const PROP_OPTIONS: { value: Costume["prop"]; label: string }[] = [
  { value: "none", label: "Пусто" },
  { value: "case", label: "Чемодан" },
  { value: "brush", label: "Кисть" },
  { value: "laptop", label: "Ноутбук" },
  { value: "flask", label: "Флакон" },
  { value: "coin", label: "Монета" },
  { value: "wrench", label: "Инструмент" },
  { value: "mic", label: "Микрофон" },
];

const GARMENTS: { key: keyof Costume; label: string }[] = [
  { key: "cloth", label: "Одежда" },
  { key: "accent", label: "Отделка" },
  { key: "trousers", label: "Штаны" },
  { key: "boots", label: "Обувь" },
  { key: "skin", label: "Кожа" },
  { key: "hair", label: "Волосы" },
];

/**
 * Live character editor.
 *
 * The palette is filled in from the brand's own logo the moment it is known —
 * a brand should not have to hand-pick six garment colours to look like itself.
 * Everything stays editable afterwards, and the preview animates so the walk
 * cycle and clothing are actually visible before committing.
 */
export function CharacterStudio({
  logoUrl,
  brandName,
  categorySlug,
  defaultName,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  const baseCostume = useMemo(
    () => costumeFor(categorySlug ?? "", {}),
    [categorySlug],
  );

  const [costume, setCostume] = useState<Costume>(baseCostume);
  const [name, setName] = useState(defaultName ?? brandName ?? "");
  const [characterType, setCharacterType] = useState(
    categorySlug && COSTUMES[categorySlug] ? categorySlug : "travel",
  );
  const [paletteState, setPaletteState] = useState<
    "idle" | "loading" | "applied" | "failed"
  >("idle");
  const [extracted, setExtracted] = useState<string[]>([]);
  const [walking, setWalking] = useState(true);

  // Re-seed when the category changes, unless the user already customised.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setCostume(baseCostume);
  }, [baseCostume, touched]);

  useEffect(() => {
    onChange?.({
      representativeName: name,
      characterType,
      outfitColor: costume.cloth,
      costume,
    });
  }, [name, characterType, costume, onChange]);

  /** Sample the logo and place its colours on the garments. */
  const applyBrandPalette = useCallback(
    async (url: string) => {
      setPaletteState("loading");
      try {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = `/api/image-proxy?url=${encodeURIComponent(url)}`;

        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("logo load failed"));
        });

        const size = 48;
        const scratch = document.createElement("canvas");
        scratch.width = size;
        scratch.height = size;
        const sctx = scratch.getContext("2d", { willReadFrequently: true });
        if (!sctx) throw new Error("no 2d context");

        sctx.drawImage(image, 0, 0, size, size);
        const { data } = sctx.getImageData(0, 0, size, size);

        const colors: Rgb[] = dominantColors(data, 4);
        if (colors.length === 0) throw new Error("no usable colours");

        setExtracted(colors.map(rgbToHex));
        setCostume((current) => deriveCostume(colors, current));
        setTouched(true);
        setPaletteState("applied");
      } catch {
        setPaletteState("failed");
      }
    },
    [],
  );

  useEffect(() => {
    if (logoUrl && paletteState === "idle") void applyBrandPalette(logoUrl);
  }, [logoUrl, paletteState, applyBrandPalette]);

  // Animation loop: a still sprite hides exactly what we want to show.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = 200;
    const cssHeight = 210;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    let raf = 0;
    let last = 0;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animate = walking && !prefersReduced;

    const render = (time: number) => {
      if (time - last > 160) {
        last = time;
        if (animate) frameRef.current = (frameRef.current + 1) % 4;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Checkerboard so light garments stay visible against the card.
      const tile = 12;
      for (let ty = 0; ty < cssHeight / tile; ty++) {
        for (let tx = 0; tx < cssWidth / tile; tx++) {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? "#f4f6f5" : "#eaeeec";
          ctx.fillRect(tx * tile, ty * tile, tile, tile);
        }
      }

      drawCharacter(ctx, cssWidth / 2, cssHeight - 22, {
        unit: 5,
        costume,
        frame: animate ? frameRef.current : 0,
        facing: 1,
        leader: true,
      });

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [costume, walking]);

  function setGarment(key: keyof Costume, value: string) {
    setTouched(true);
    setCostume((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-4 rounded-brand border border-[var(--color-border)] p-4">
      <div>
        <h3 className="font-semibold text-ink">Представитель бренда на карте</h3>
        <p className="mt-0.5 text-sm text-muted">
          Палитра подбирается из вашего логотипа. Всё можно поправить вручную.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0 space-y-2">
          <canvas
            ref={canvasRef}
            className="rounded-brand border border-[var(--color-border)]"
            role="img"
            aria-label={`Предпросмотр персонажа${name ? ` — ${name}` : ""}`}
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setWalking((w) => !w)}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              {walking ? "Остановить" : "Оживить"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => void applyBrandPalette(logoUrl)}
                className="text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                Подобрать из логотипа
              </button>
            )}
          </div>

          {paletteState === "loading" && (
            <p className="text-xs text-muted">Читаем цвета логотипа…</p>
          )}
          {paletteState === "applied" && extracted.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted">Цвета бренда</p>
              <div className="flex gap-1">
                {extracted.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    title={`Сделать основным: ${hex}`}
                    onClick={() => {
                      setTouched(true);
                      setCostume((current) =>
                        costumeFromSingleColor(hex, current),
                      );
                    }}
                    className="h-6 w-6 rounded border border-[var(--color-border)]"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          )}
          {paletteState === "failed" && (
            <p className="text-xs text-muted">
              Логотип не прочитался — выберите цвет вручную.
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <label
              htmlFor="char-name"
              className="block text-sm font-medium text-ink"
            >
              Имя представителя
            </label>
            <input
              id="char-name"
              type="text"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder={brandName ?? "Имя"}
              className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted">
              Имя проходит модерацию: нельзя выдавать себя за другой бренд.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="char-role"
                className="block text-sm font-medium text-ink"
              >
                Образ
              </label>
              <select
                id="char-role"
                value={characterType}
                onChange={(e) => {
                  const next = e.target.value;
                  setCharacterType(next);
                  setTouched(true);
                  // Keep the brand colours, take the new silhouette.
                  const preset = COSTUMES[next] ?? DEFAULT_COSTUME;
                  setCostume((current) => ({
                    ...current,
                    head: preset.head,
                    prop: preset.prop,
                    cape: preset.cape,
                    label: preset.label,
                  }));
                }}
                className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                {Object.entries(COSTUMES).map(([slug, preset]) => (
                  <option key={slug} value={slug}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="char-head"
                className="block text-sm font-medium text-ink"
              >
                Головное
              </label>
              <select
                id="char-head"
                value={costume.head}
                onChange={(e) => {
                  setTouched(true);
                  setCostume((c) => ({
                    ...c,
                    head: e.target.value as Costume["head"],
                  }));
                }}
                className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                {HEAD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="char-prop"
                className="block text-sm font-medium text-ink"
              >
                В руке
              </label>
              <select
                id="char-prop"
                value={costume.prop}
                onChange={(e) => {
                  setTouched(true);
                  setCostume((c) => ({
                    ...c,
                    prop: e.target.value as Costume["prop"],
                  }));
                }}
                className="mt-1 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                {PROP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={costume.cape}
                  onChange={(e) => {
                    setTouched(true);
                    setCostume((c) => ({ ...c, cape: e.target.checked }));
                  }}
                />
                Плащ
              </label>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-ink">Цвета</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GARMENTS.map((garment) => (
                <label
                  key={garment.key}
                  className="flex items-center gap-2 text-xs text-muted"
                >
                  <input
                    type="color"
                    value={String(costume[garment.key])}
                    onChange={(e) => setGarment(garment.key, e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-[var(--color-border)] bg-white"
                    aria-label={garment.label}
                  />
                  {garment.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
