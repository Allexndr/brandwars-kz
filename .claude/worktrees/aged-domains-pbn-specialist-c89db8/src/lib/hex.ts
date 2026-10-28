/** Axial hex helpers (pointy-top), Civ-style grid math */

export type Hex = { q: number; r: number };

export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function hexToPixel(h: Hex, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
  const y = size * ((3 / 2) * h.r);
  return { x, y };
}

export function pixelToHex(x: number, y: number, size: number): Hex {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size;
  const r = ((2 / 3) * y) / size;
  return hexRound({ q, r });
}

export function hexRound(h: { q: number; r: number }): Hex {
  const s = -h.q - h.r;
  let rq = Math.round(h.q);
  let rr = Math.round(h.r);
  const rs = Math.round(s);
  const qDiff = Math.abs(rq - h.q);
  const rDiff = Math.abs(rr - h.r);
  const sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr };
}

export const HEX_DIRS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbor(h: Hex, i: number): Hex {
  const d = HEX_DIRS[i % 6];
  return { q: h.q + d.q, r: h.r + d.r };
}

export function hexDistance(a: Hex, b: Hex): number {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) /
    2
  );
}

/** Spiral ring around center, Civ-style continent blob */
export function hexSpiral(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [center];
  if (radius === 0) return out;
  for (let k = 1; k <= radius; k++) {
    let h = { q: center.q + HEX_DIRS[4].q * k, r: center.r + HEX_DIRS[4].r * k };
    for (let d = 0; d < 6; d++) {
      for (let step = 0; step < k; step++) {
        out.push(h);
        h = hexNeighbor(h, d);
      }
    }
  }
  return out;
}

export function hexPolygonPoints(cx: number, cy: number, size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(cx + size * Math.cos(angle), cy + size * Math.sin(angle));
  }
  return pts;
}

/** Deterministic hash for terrain variation */
export function hashHex(h: Hex): number {
  let n = h.q * 374761393 + h.r * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
