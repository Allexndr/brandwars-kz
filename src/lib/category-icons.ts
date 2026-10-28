/**
 * A glyph per continent, drawn straight onto the map cells.
 *
 * Colour alone does not say what a landmass is: twenty-four hues on one globe
 * are indistinguishable without reading the label, and labels only fit on a few
 * continents at once. A heart on the health cells and a plane on the travel
 * cells makes the map readable at a glance, at any zoom, without text.
 *
 * Everything is drawn from rects and simple paths on a 16x16 grid so the glyphs
 * stay crisp at the small sizes cells actually get, and cost nothing to render
 * across a thousand of them.
 */

type Ctx = CanvasRenderingContext2D;

export type IconKind =
  | "plane" | "fork" | "bag" | "drop" | "shirt" | "heart" | "dumbbell"
  | "book" | "coin" | "house" | "car" | "box" | "code" | "chip"
  | "signal" | "shield" | "megaphone" | "play" | "joystick" | "star"
  | "lamp" | "leaf" | "briefcase" | "dot";

export const CATEGORY_ICONS: Record<string, IconKind> = {
  travel: "plane",
  food: "fork",
  retail: "bag",
  beauty: "drop",
  fashion: "shirt",
  health: "heart",
  fitness: "dumbbell",
  education: "book",
  finance: "coin",
  "real-estate": "house",
  auto: "car",
  logistics: "box",
  code: "code",
  "ai-agents": "chip",
  telecom: "signal",
  security: "shield",
  marketing: "megaphone",
  media: "play",
  games: "joystick",
  events: "star",
  home: "lamp",
  agro: "leaf",
  b2b: "briefcase",
  other: "dot",
};

export function iconFor(categorySlug: string): IconKind {
  return CATEGORY_ICONS[categorySlug] ?? "dot";
}

/**
 * Draw the glyph centred on (x, y), sized to fit a box of `size` pixels.
 *
 * The caller sets `globalAlpha` — on a crowded map the glyph works better as
 * texture than as a hard mark.
 */
export function drawCategoryIcon(
  ctx: Ctx,
  kind: IconKind,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  // A 16-unit design grid keeps every glyph proportional to the cell.
  const u = size / 16;
  const px = (gx: number, gy: number, gw: number, gh: number) => {
    ctx.fillRect(x + (gx - 8) * u, y + (gy - 8) * u, gw * u, gh * u);
  };

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.8, 1.6 * u);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (kind) {
    case "plane":
      ctx.beginPath();
      ctx.moveTo(x - 6 * u, y + 1 * u);
      ctx.lineTo(x + 6 * u, y - 3 * u);
      ctx.lineTo(x + 2 * u, y + 2 * u);
      ctx.lineTo(x + 5 * u, y + 5 * u);
      ctx.lineTo(x - 1 * u, y + 3 * u);
      ctx.closePath();
      ctx.fill();
      break;

    case "fork":
      px(6, 2, 1.4, 6);
      px(9, 2, 1.4, 6);
      px(7, 7, 2.4, 7);
      break;

    case "bag":
      px(4, 6, 8, 8);
      ctx.beginPath();
      ctx.arc(x, y - 3 * u, 3 * u, Math.PI, 0);
      ctx.stroke();
      break;

    case "drop":
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * u);
      ctx.quadraticCurveTo(x + 5 * u, y + 1 * u, x, y + 6 * u);
      ctx.quadraticCurveTo(x - 5 * u, y + 1 * u, x, y - 6 * u);
      ctx.fill();
      break;

    case "shirt":
      ctx.beginPath();
      ctx.moveTo(x - 6 * u, y - 3 * u);
      ctx.lineTo(x - 2 * u, y - 5 * u);
      ctx.lineTo(x + 2 * u, y - 5 * u);
      ctx.lineTo(x + 6 * u, y - 3 * u);
      ctx.lineTo(x + 4 * u, y + 0 * u);
      ctx.lineTo(x + 4 * u, y + 6 * u);
      ctx.lineTo(x - 4 * u, y + 6 * u);
      ctx.lineTo(x - 4 * u, y + 0 * u);
      ctx.closePath();
      ctx.fill();
      break;

    case "heart":
      ctx.beginPath();
      ctx.moveTo(x, y + 5 * u);
      ctx.bezierCurveTo(x - 8 * u, y - 1 * u, x - 4 * u, y - 7 * u, x, y - 2.5 * u);
      ctx.bezierCurveTo(x + 4 * u, y - 7 * u, x + 8 * u, y - 1 * u, x, y + 5 * u);
      ctx.fill();
      break;

    case "dumbbell":
      px(2, 5, 2.5, 6);
      px(11.5, 5, 2.5, 6);
      px(4.5, 7, 7, 2);
      break;

    case "book":
      px(3, 3, 5, 10);
      px(8.5, 3, 5, 10);
      ctx.globalAlpha *= 0.55;
      px(3, 3, 10.5, 1.4);
      break;

    case "coin":
      ctx.beginPath();
      ctx.arc(x, y, 6 * u, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "house":
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * u);
      ctx.lineTo(x + 7 * u, y);
      ctx.lineTo(x - 7 * u, y);
      ctx.closePath();
      ctx.fill();
      px(3, 8, 10, 6);
      break;

    case "car":
      px(2, 8, 12, 4);
      ctx.beginPath();
      ctx.moveTo(x - 4 * u, y);
      ctx.lineTo(x - 2.5 * u, y - 4 * u);
      ctx.lineTo(x + 2.5 * u, y - 4 * u);
      ctx.lineTo(x + 4 * u, y);
      ctx.closePath();
      ctx.fill();
      break;

    case "box":
      px(3, 4, 10, 10);
      ctx.globalAlpha *= 0.5;
      px(7, 4, 2, 10);
      break;

    case "code":
      ctx.beginPath();
      ctx.moveTo(x - 2 * u, y - 6 * u);
      ctx.lineTo(x - 6 * u, y);
      ctx.lineTo(x - 2 * u, y + 6 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 2 * u, y - 6 * u);
      ctx.lineTo(x + 6 * u, y);
      ctx.lineTo(x + 2 * u, y + 6 * u);
      ctx.stroke();
      break;

    case "chip":
      px(4, 4, 8, 8);
      // pins
      px(1.5, 6, 2, 1.2);
      px(1.5, 9, 2, 1.2);
      px(12.5, 6, 2, 1.2);
      px(12.5, 9, 2, 1.2);
      px(6, 1.5, 1.2, 2);
      px(9, 1.5, 1.2, 2);
      px(6, 12.5, 1.2, 2);
      px(9, 12.5, 1.2, 2);
      break;

    case "signal":
      px(3, 10, 2, 4);
      px(6.5, 7, 2, 7);
      px(10, 4, 2, 10);
      break;

    case "shield":
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * u);
      ctx.lineTo(x + 5 * u, y - 4 * u);
      ctx.lineTo(x + 5 * u, y + 1 * u);
      ctx.quadraticCurveTo(x + 5 * u, y + 5 * u, x, y + 6.5 * u);
      ctx.quadraticCurveTo(x - 5 * u, y + 5 * u, x - 5 * u, y + 1 * u);
      ctx.lineTo(x - 5 * u, y - 4 * u);
      ctx.closePath();
      ctx.fill();
      break;

    case "megaphone":
      ctx.beginPath();
      ctx.moveTo(x - 6 * u, y - 2 * u);
      ctx.lineTo(x + 2 * u, y - 6 * u);
      ctx.lineTo(x + 2 * u, y + 6 * u);
      ctx.lineTo(x - 6 * u, y + 2 * u);
      ctx.closePath();
      ctx.fill();
      px(11, 6, 3, 4);
      break;

    case "play":
      ctx.beginPath();
      ctx.moveTo(x - 4 * u, y - 6 * u);
      ctx.lineTo(x + 6 * u, y);
      ctx.lineTo(x - 4 * u, y + 6 * u);
      ctx.closePath();
      ctx.fill();
      break;

    case "joystick":
      px(2, 8, 12, 5);
      px(7, 3, 2, 5);
      ctx.beginPath();
      ctx.arc(x, y - 5 * u, 2.4 * u, 0, Math.PI * 2);
      ctx.fill();
      break;

    case "star":
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 7 * u : 3 * u;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const sx = x + Math.cos(a) * r;
        const sy = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      break;

    case "lamp":
      ctx.beginPath();
      ctx.moveTo(x - 6 * u, y + 1 * u);
      ctx.lineTo(x - 3 * u, y - 6 * u);
      ctx.lineTo(x + 3 * u, y - 6 * u);
      ctx.lineTo(x + 6 * u, y + 1 * u);
      ctx.closePath();
      ctx.fill();
      px(7.4, 9, 1.4, 5);
      break;

    case "leaf":
      ctx.beginPath();
      ctx.moveTo(x - 5 * u, y + 5 * u);
      ctx.quadraticCurveTo(x - 5 * u, y - 6 * u, x + 6 * u, y - 5 * u);
      ctx.quadraticCurveTo(x + 5 * u, y + 6 * u, x - 5 * u, y + 5 * u);
      ctx.fill();
      break;

    case "briefcase":
      px(2, 6, 12, 8);
      ctx.globalAlpha *= 0.6;
      px(6, 3, 4, 2);
      break;

    case "dot":
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * u, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.restore();
}
