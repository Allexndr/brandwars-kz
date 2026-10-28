/**
 * Deriving a character costume from a company's own colours.
 *
 * Asking a brand to hand-pick six garment colours is a chore nobody finishes.
 * Instead we sample the brand's favicon or logo, quantise it to a handful of
 * dominant colours, and place them on the sprite by role: the strongest colour
 * becomes the tunic, the most contrasting one the trim, and the darkest the
 * trousers and boots. The result already looks like the brand.
 *
 * Pure functions — no DOM, no network — so this is testable and usable on both
 * sides.
 */

import type { Costume } from "@/lib/character-sprites";
import { DEFAULT_COSTUME } from "@/lib/character-sprites";

export type Rgb = { r: number; g: number; b: number };

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Perceived brightness, 0..255. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function saturation({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function distance(a: Rgb, b: Rgb): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

/**
 * Bucket pixels into a coarse colour cube and return the most populated
 * buckets, brightest-first within a bucket.
 *
 * Near-white, near-black and near-grey pixels are skipped: a logo is mostly
 * background, and letting that background win produces a grey character every
 * time — which is exactly the washed-out result we are fixing.
 */
export function dominantColors(
  pixels: Uint8ClampedArray,
  maxColors = 4,
): Rgb[] {
  const buckets = new Map<string, { sum: Rgb; count: number }>();

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 128) continue;

    const rgb = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
    const lum = luminance(rgb);
    if (lum > 238 || lum < 18) continue;
    if (saturation(rgb) < 0.12) continue;

    // 32-level cube keeps shades of the same brand colour together.
    const key = `${rgb.r >> 5}-${rgb.g >> 5}-${rgb.b >> 5}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sum.r += rgb.r;
      bucket.sum.g += rgb.g;
      bucket.sum.b += rgb.b;
      bucket.count++;
    } else {
      buckets.set(key, { sum: { ...rgb }, count: 1 });
    }
  }

  const averaged = [...buckets.values()]
    .map((bucket) => ({
      count: bucket.count,
      rgb: {
        r: bucket.sum.r / bucket.count,
        g: bucket.sum.g / bucket.count,
        b: bucket.sum.b / bucket.count,
      },
    }))
    .sort((a, b) => b.count - a.count);

  // Drop near-duplicates so a two-tone logo does not fill every slot.
  const picked: Rgb[] = [];
  for (const candidate of averaged) {
    if (picked.some((existing) => distance(existing, candidate.rgb) < 60)) continue;
    picked.push(candidate.rgb);
    if (picked.length >= maxColors) break;
  }

  return picked;
}

function shift(rgb: Rgb, factor: number): Rgb {
  return { r: rgb.r * factor, g: rgb.g * factor, b: rgb.b * factor };
}

/** A readable trim colour for a given tunic: complementary-ish and light. */
function trimFor(primary: Rgb): Rgb {
  const lum = luminance(primary);
  if (lum < 120) {
    // Dark tunic: a warm light trim reads best.
    return { r: 245, g: 215, b: 140 };
  }
  // Light tunic: a deep trim keeps the silhouette legible.
  return shift(primary, 0.45);
}

/**
 * Map brand colours onto garment roles.
 *
 * `base` keeps whatever the category costume already decided about silhouette
 * (headwear, prop, cape), so a brand recolours its representative without
 * losing the visual language of its continent.
 */
export function deriveCostume(
  colors: Rgb[],
  base: Costume = DEFAULT_COSTUME,
): Costume {
  if (colors.length === 0) return base;

  const sorted = [...colors].sort(
    (a, b) => saturation(b) * 255 + luminance(b) * 0.2 - (saturation(a) * 255 + luminance(a) * 0.2),
  );

  const primary = sorted[0];
  const secondary = sorted[1] ?? trimFor(primary);

  // Trousers and boots come from the darkest available colour so the lower body
  // grounds the figure instead of vibrating with the tunic.
  const darkest = [...colors].sort((a, b) => luminance(a) - luminance(b))[0];
  const trousers = luminance(darkest) < 90 ? darkest : shift(primary, 0.34);

  const accent =
    distance(primary, secondary) > 90 ? secondary : trimFor(primary);

  return {
    ...base,
    cloth: rgbToHex(primary),
    accent: rgbToHex(accent),
    trousers: rgbToHex(trousers),
    boots: rgbToHex(shift(trousers, 0.78)),
  };
}

/** Derive a full costume from one hand-picked colour. */
export function costumeFromSingleColor(
  hex: string,
  base: Costume = DEFAULT_COSTUME,
): Costume {
  const primary = hexToRgb(hex);
  return deriveCostume([primary, trimFor(primary), shift(primary, 0.3)], base);
}
