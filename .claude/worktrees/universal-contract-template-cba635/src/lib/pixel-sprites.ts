/** Pixel-art drawing helpers — integer scale, no smoothing */

export function pixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function hexRgb(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

/** 16×16 pixel dude, scaled. frame 0–3 for walk/idle bob */
export function drawPixelDude(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  body: number,
  accent: number,
  frame: number,
  facing: 1 | -1,
) {
  const u = Math.max(1, Math.round(scale));
  const bob = frame % 2 === 0 ? 0 : u;
  const ox = Math.round(x - 8 * u);
  const oy = Math.round(y - 16 * u - bob);
  const skin = "#ffd5aa";
  const outline = "#1a2340";
  const bodyC = hexRgb(body);
  const acc = hexRgb(accent);
  const walk = frame % 4;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (facing < 0) {
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.translate(-Math.round(x), 0);
  }

  // shadow
  pixelRect(ctx, ox + 4 * u, oy + 15 * u, 8 * u, u, "rgba(0,0,0,0.35)");

  // legs
  const legOff = walk === 1 || walk === 2 ? u : 0;
  pixelRect(ctx, ox + 5 * u, oy + 12 * u, 2 * u, 3 * u + (walk % 2) * u, outline);
  pixelRect(ctx, ox + 9 * u - legOff, oy + 12 * u, 2 * u, 3 * u + ((walk + 1) % 2) * u, outline);
  pixelRect(ctx, ox + 5 * u, oy + 12 * u, 2 * u, 2 * u, acc);
  pixelRect(ctx, ox + 9 * u - legOff, oy + 12 * u, 2 * u, 2 * u, acc);

  // body
  pixelRect(ctx, ox + 4 * u, oy + 7 * u, 8 * u, 5 * u, outline);
  pixelRect(ctx, ox + 5 * u, oy + 8 * u, 6 * u, 4 * u, bodyC);
  pixelRect(ctx, ox + 6 * u, oy + 9 * u, 4 * u, 2 * u, acc);

  // head
  pixelRect(ctx, ox + 5 * u, oy + 3 * u, 6 * u, 5 * u, outline);
  pixelRect(ctx, ox + 6 * u, oy + 4 * u, 4 * u, 3 * u, skin);
  pixelRect(ctx, ox + 7 * u, oy + 5 * u, u, u, outline);
  pixelRect(ctx, ox + 9 * u, oy + 5 * u, u, u, outline);

  // hat / crown for leaders (scale>2.2 used as leader flag by caller via extra)
  ctx.restore();
}

export function drawPixelCrown(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
) {
  const u = Math.max(1, Math.round(scale));
  const ox = Math.round(x - 5 * u);
  const oy = Math.round(y - 20 * u);
  pixelRect(ctx, ox, oy, 10 * u, 2 * u, "#1a2340");
  pixelRect(ctx, ox + u, oy - 2 * u, 2 * u, 3 * u, "#ffd658");
  pixelRect(ctx, ox + 4 * u, oy - 3 * u, 2 * u, 4 * u, "#ffd658");
  pixelRect(ctx, ox + 7 * u, oy - 2 * u, 2 * u, 3 * u, "#ffd658");
}

export function drawPixelKeep(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: number,
) {
  const u = Math.max(1, Math.round(scale * 0.7));
  const ox = Math.round(x - 7 * u);
  const oy = Math.round(y - 10 * u);
  const wall = hexRgb(color);
  pixelRect(ctx, ox, oy + 4 * u, 14 * u, 8 * u, "#1a2340");
  pixelRect(ctx, ox + u, oy + 5 * u, 12 * u, 6 * u, wall);
  pixelRect(ctx, ox + 2 * u, oy, 3 * u, 6 * u, wall);
  pixelRect(ctx, ox + 9 * u, oy, 3 * u, 6 * u, wall);
  pixelRect(ctx, ox + 6 * u, oy + 7 * u, 2 * u, 4 * u, "#1a2340");
  pixelRect(ctx, ox + 5 * u, oy + 2 * u, 4 * u, 2 * u, "#f8fafc");
}

export function drawClashBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  colorA: number,
  colorB: number,
) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 10);
  const r = 6 + pulse * 8;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 4;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    ctx.fillStyle = hexRgb(i % 2 === 0 ? colorA : colorB);
    ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4);
  }
  ctx.fillStyle = "#fff7d6";
  ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
  ctx.restore();
}

export function drawPixelTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
) {
  const u = Math.max(1, Math.round(scale * 0.55));
  pixelRect(ctx, x - u, y - 2 * u, 2 * u, 5 * u, "#3d2914");
  pixelRect(ctx, x - 3 * u, y - 7 * u, 6 * u, 5 * u, "#2f6b32");
  pixelRect(ctx, x - 2 * u, y - 9 * u, 4 * u, 3 * u, "#3d8f44");
}

export function drawPixelFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: number,
  t: number,
) {
  const u = Math.max(1, Math.round(scale * 0.5));
  const wave = Math.round(Math.sin(t * 6) * u);
  pixelRect(ctx, x, y - 10 * u, u, 12 * u, "#1a2340");
  pixelRect(ctx, x + u, y - 10 * u + wave, 6 * u, 4 * u, hexRgb(color));
  pixelRect(ctx, x + u, y - 9 * u + wave, 5 * u, 2 * u, "#f8fafc");
}
