/**
 * Detailed character sprites.
 *
 * The previous dudes were 16px silhouettes: a body rectangle, a head rectangle,
 * two legs. At that size you cannot tell a courier from a stylist, so the
 * costume — the whole point of letting a brand dress its representative —
 * carried no information.
 *
 * These are built on a 18x30 grid with three tones per material (shade / base /
 * light), a dark silhouette pass for readability at small scale, and separate
 * garment layers: boots, trousers, tunic, belt, pauldrons, gloves, cape, hair
 * and headwear. Every part is a flat rect fill — no gradients, no images — so a
 * crowd still renders in one pass per frame.
 */

export type Tone = { shade: string; base: string; light: string };

export type Costume = {
  /** Shown in the customiser. */
  label: string;
  cloth: string;
  trousers: string;
  boots: string;
  accent: string;
  skin: string;
  hair: string;
  /** Headwear silhouette. */
  head: "none" | "cap" | "hood" | "helmet" | "band" | "tophat" | "visor";
  /** Object carried in the front hand. */
  prop: "none" | "case" | "brush" | "laptop" | "flask" | "coin" | "wrench" | "mic";
  cape: boolean;
};

const SPRITE_W = 18;
const SPRITE_H = 30;

/** Cheap, predictable tone ramp from one hex colour. */
export function toneOf(hex: string): Tone {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;

  const mix = (channel: number, factor: number) =>
    Math.max(0, Math.min(255, Math.round(channel * factor)));

  const rgb = (rr: number, gg: number, bb: number) => `rgb(${rr},${gg},${bb})`;

  return {
    shade: rgb(mix(r, 0.62), mix(g, 0.62), mix(b, 0.68)),
    base: rgb(r, g, b),
    light: rgb(
      mix(r, 1.28) + 12,
      mix(g, 1.28) + 12,
      mix(b, 1.24) + 8,
    ),
  };
}

const OUTLINE = "#141a2e";

/** Per-continent costumes, so a crowd reads as its category at a glance. */
export const COSTUMES: Record<string, Costume> = {
  travel: {
    label: "Гид",
    cloth: "#2f6fd0", trousers: "#26355c", boots: "#3b2a1c",
    accent: "#f2c14e", skin: "#f3c99a", hair: "#3a2a1a",
    head: "cap", prop: "case", cape: false,
  },
  beauty: {
    label: "Стилист",
    cloth: "#e05fa2", trousers: "#4a2740", boots: "#6b3350",
    accent: "#ffd9ec", skin: "#f7d3ad", hair: "#5b2340",
    head: "band", prop: "brush", cape: false,
  },
  code: {
    label: "Инженер",
    cloth: "#2b3d5c", trousers: "#1f2a3d", boots: "#2a2a30",
    accent: "#35d1c4", skin: "#eec49a", hair: "#231c18",
    head: "hood", prop: "laptop", cape: false,
  },
  "ai-agents": {
    label: "Оператор",
    cloth: "#6d4fd0", trousers: "#2c2450", boots: "#332b52",
    accent: "#b9a4ff", skin: "#f0c69c", hair: "#2b2036",
    head: "visor", prop: "flask", cape: false,
  },
  finance: {
    label: "Казначей",
    cloth: "#12665c", trousers: "#123a38", boots: "#2b2a22",
    accent: "#e8c765", skin: "#f2c79b", hair: "#241a12",
    head: "tophat", prop: "coin", cape: true,
  },
  health: {
    label: "Медик",
    cloth: "#e8eef0", trousers: "#3a4b57", boots: "#2f3a42",
    accent: "#28a06a", skin: "#f3cba2", hair: "#2c2118",
    head: "band", prop: "flask", cape: false,
  },
  logistics: {
    label: "Курьер",
    cloth: "#d2691e", trousers: "#3d2b1c", boots: "#2f2016",
    accent: "#ffd28a", skin: "#e8bd8f", hair: "#1f1710",
    head: "cap", prop: "case", cape: false,
  },
  security: {
    label: "Стражник",
    cloth: "#4a5766", trousers: "#2b323c", boots: "#23282f",
    accent: "#9fb4c9", skin: "#eec49a", hair: "#20242c",
    head: "helmet", prop: "wrench", cape: true,
  },
  marketing: {
    label: "Глашатай",
    cloth: "#d33d3d", trousers: "#3a2028", boots: "#2c1c20",
    accent: "#ffcf6b", skin: "#f3c99a", hair: "#2a1a14",
    head: "none", prop: "mic", cape: true,
  },
  media: {
    label: "Репортёр",
    cloth: "#c2416b", trousers: "#39243a", boots: "#2a1c28",
    accent: "#ffd0e0", skin: "#f0c69c", hair: "#2b1d20",
    head: "none", prop: "mic", cape: false,
  },
  games: {
    label: "Чемпион",
    cloth: "#7b3fd4", trousers: "#2a1f48", boots: "#251d3a",
    accent: "#5ff2c8", skin: "#f2c79b", hair: "#1e1830",
    head: "helmet", prop: "wrench", cape: true,
  },
  education: {
    label: "Наставник",
    cloth: "#c9a227", trousers: "#3c3520", boots: "#2c2718",
    accent: "#fff0b8", skin: "#f3cba2", hair: "#3a2a18",
    head: "tophat", prop: "laptop", cape: true,
  },
};

export const DEFAULT_COSTUME: Costume = {
  label: "Житель",
  cloth: "#3f7fb5", trousers: "#2b3648", boots: "#2c2620",
  accent: "#f0d08a", skin: "#f0c69c", hair: "#2a2018",
  head: "none", prop: "none", cape: false,
};

export function costumeFor(categorySlug: string, override?: Partial<Costume>): Costume {
  return { ...(COSTUMES[categorySlug] ?? DEFAULT_COSTUME), ...(override ?? {}) };
}

/** Costume keys offered in the customiser. */
export const CHARACTER_TYPES = Object.keys(COSTUMES);

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

export type DrawCharacterOptions = {
  /** Grid unit size in device pixels. 2 reads well on the map, 4+ for portraits. */
  unit: number;
  costume: Costume;
  /** Animation frame counter. */
  frame: number;
  facing: 1 | -1;
  /** Adds cape, pauldron trim and a crown. */
  leader?: boolean;
  /** Dim non-leaders so the hero reads first. */
  dim?: boolean;
};

/**
 * Draw one character with its feet at (x, y).
 *
 * Layer order is back-to-front: shadow, cape, back limbs, torso, front limbs,
 * head, headwear. Each garment paints its shade tone first and its base tone
 * inset by one unit, which is what produces the volume.
 */
export function drawCharacter(
  ctx: Ctx,
  x: number,
  y: number,
  options: DrawCharacterOptions,
) {
  const u = Math.max(1, options.unit);
  const { costume, frame, facing } = options;

  // Two-frame idle bob plus a four-phase walk cycle.
  const walk = frame % 4;
  const bob = walk === 1 || walk === 3 ? u : 0;
  const swing = walk === 1 ? u : walk === 3 ? -u : 0;

  const cloth = toneOf(costume.cloth);
  const trousers = toneOf(costume.trousers);
  const boots = toneOf(costume.boots);
  const accent = toneOf(costume.accent);
  const skin = toneOf(costume.skin);
  const hair = toneOf(costume.hair);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (options.dim) ctx.globalAlpha = 0.72;

  // Mirror around the character's own axis so facing does not shift position.
  if (facing < 0) {
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.translate(-Math.round(x), 0);
  }

  const left = Math.round(x - (SPRITE_W / 2) * u);
  const top = Math.round(y - SPRITE_H * u - bob);
  const gx = (col: number) => left + col * u;
  const gy = (row: number) => top + row * u;

  // ---- ground shadow (stays put while the body bobs) ----
  ctx.fillStyle = "rgba(10,14,24,0.28)";
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), 5.5 * u, 1.6 * u, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- cape behind everything ----
  if (costume.cape || options.leader) {
    px(ctx, gx(4), gy(9), 10 * u, u, OUTLINE);
    px(ctx, gx(4), gy(10), 2 * u, 13 * u, accent.shade);
    px(ctx, gx(12), gy(10), 2 * u, 13 * u, accent.shade);
    px(ctx, gx(5), gy(10), 8 * u, 12 * u, accent.base);
    // fold lines give the cloth some depth
    px(ctx, gx(8), gy(11), u, 11 * u, accent.shade);
    px(ctx, gx(6), gy(20), u, 3 * u, accent.shade);
    px(ctx, gx(11), gy(20), u, 3 * u, accent.shade);
  }

  // ---- back leg ----
  const backLegX = gx(6) - swing;
  px(ctx, backLegX - u, gy(20), 4 * u, 7 * u, OUTLINE);
  px(ctx, backLegX, gy(20), 2 * u, 5 * u, trousers.shade);
  px(ctx, backLegX, gy(25), 2 * u, 3 * u, boots.shade);

  // ---- front leg ----
  const frontLegX = gx(10) + swing;
  px(ctx, frontLegX - u, gy(20), 4 * u, 7 * u, OUTLINE);
  px(ctx, frontLegX, gy(20), 2 * u, 5 * u, trousers.base);
  px(ctx, frontLegX, gy(20), u, 5 * u, trousers.light);
  // boot with a cuff highlight
  px(ctx, frontLegX, gy(25), 2 * u, 3 * u, boots.base);
  px(ctx, frontLegX, gy(25), 2 * u, u, boots.light);

  // ---- torso ----
  px(ctx, gx(4), gy(9), 10 * u, 12 * u, OUTLINE);
  px(ctx, gx(5), gy(10), 8 * u, 10 * u, cloth.shade);
  px(ctx, gx(5), gy(10), 7 * u, 10 * u, cloth.base);
  // lit edge along the facing side
  px(ctx, gx(5), gy(10), 2 * u, 9 * u, cloth.light);
  // collar
  px(ctx, gx(7), gy(10), 4 * u, u, accent.base);

  // chest emblem — the brand's accent, readable even at unit 2
  px(ctx, gx(8), gy(13), 2 * u, 2 * u, accent.light);

  // ---- belt ----
  px(ctx, gx(4), gy(18), 10 * u, 2 * u, OUTLINE);
  px(ctx, gx(5), gy(18), 8 * u, u, trousers.shade);
  px(ctx, gx(8), gy(18), 2 * u, u, accent.base); // buckle

  // ---- back arm ----
  px(ctx, gx(3), gy(10) + swing, 3 * u, 9 * u, OUTLINE);
  px(ctx, gx(4), gy(11) + swing, u, 7 * u, cloth.shade);

  // ---- pauldrons ----
  px(ctx, gx(3), gy(9), 4 * u, 3 * u, OUTLINE);
  px(ctx, gx(4), gy(10), 2 * u, 2 * u, accent.base);
  px(ctx, gx(4), gy(10), 2 * u, u, accent.light);
  px(ctx, gx(12), gy(9), 3 * u, 3 * u, OUTLINE);
  px(ctx, gx(12), gy(10), 2 * u, 2 * u, accent.shade);

  // ---- front arm + glove ----
  const armY = gy(11) - swing;
  px(ctx, gx(12), armY - u, 4 * u, 9 * u, OUTLINE);
  px(ctx, gx(13), armY, 2 * u, 5 * u, cloth.base);
  px(ctx, gx(13), armY, u, 5 * u, cloth.light);
  px(ctx, gx(13), armY + 5 * u, 2 * u, 2 * u, skin.base); // hand
  px(ctx, gx(13), armY + 5 * u, 2 * u, u, skin.light);

  // ---- carried prop ----
  drawProp(ctx, costume.prop, gx(13), armY + 7 * u, u, accent, cloth);

  // ---- head ----
  px(ctx, gx(5), gy(2), 8 * u, 8 * u, OUTLINE);
  px(ctx, gx(6), gy(3), 6 * u, 6 * u, skin.shade);
  px(ctx, gx(6), gy(3), 5 * u, 6 * u, skin.base);
  px(ctx, gx(6), gy(3), 2 * u, 4 * u, skin.light);
  // jaw shadow separates head from torso
  px(ctx, gx(6), gy(8), 6 * u, u, skin.shade);

  // eye: white then pupil, so it reads as a face and not a dot
  px(ctx, gx(9), gy(5), 2 * u, 2 * u, "#f7f7fb");
  px(ctx, gx(10), gy(5), u, 2 * u, OUTLINE);
  // brow
  px(ctx, gx(9), gy(4), 2 * u, u, hair.shade);
  // nose
  px(ctx, gx(11), gy(6), u, u, skin.shade);
  // mouth
  px(ctx, gx(9), gy(7), 2 * u, u, skin.shade);

  // ---- hair ----
  px(ctx, gx(5), gy(2), 8 * u, 2 * u, hair.base);
  px(ctx, gx(5), gy(2), 8 * u, u, hair.light);
  px(ctx, gx(5), gy(4), u, 3 * u, hair.base); // sideburn behind the face

  drawHeadwear(ctx, costume.head, gx, gy, u, accent, cloth, hair);

  if (options.leader) drawCrown(ctx, gx(6), gy(0), u);

  ctx.restore();
}

function drawProp(
  ctx: Ctx,
  prop: Costume["prop"],
  x: number,
  y: number,
  u: number,
  accent: Tone,
  cloth: Tone,
) {
  if (prop === "none") return;

  switch (prop) {
    case "case":
      px(ctx, x - u, y, 5 * u, 4 * u, OUTLINE);
      px(ctx, x, y + u, 3 * u, 2 * u, accent.base);
      px(ctx, x, y + u, 3 * u, u, accent.light);
      px(ctx, x + u, y, u, u, OUTLINE); // handle
      break;
    case "brush":
      px(ctx, x, y, u, 5 * u, OUTLINE);
      px(ctx, x, y + 3 * u, 2 * u, 2 * u, accent.base);
      break;
    case "laptop":
      px(ctx, x - u, y, 6 * u, 4 * u, OUTLINE);
      px(ctx, x, y + u, 4 * u, 2 * u, "#cfe6f5");
      px(ctx, x, y + 3 * u, 4 * u, u, cloth.shade);
      break;
    case "flask":
      px(ctx, x, y, 3 * u, 4 * u, OUTLINE);
      px(ctx, x + u, y + u, u, 2 * u, accent.light);
      break;
    case "coin":
      px(ctx, x, y, 3 * u, 3 * u, OUTLINE);
      px(ctx, x, y + u, 3 * u, u, accent.light);
      break;
    case "wrench":
      px(ctx, x, y, u, 5 * u, OUTLINE);
      px(ctx, x - u, y, 3 * u, 2 * u, accent.shade);
      break;
    case "mic":
      px(ctx, x, y, u, 4 * u, OUTLINE);
      px(ctx, x - u, y, 3 * u, 2 * u, accent.base);
      px(ctx, x - u, y, 3 * u, u, accent.light);
      break;
  }
}

function drawHeadwear(
  ctx: Ctx,
  head: Costume["head"],
  gx: (c: number) => number,
  gy: (r: number) => number,
  u: number,
  accent: Tone,
  cloth: Tone,
  hair: Tone,
) {
  switch (head) {
    case "cap":
      px(ctx, gx(5), gy(1), 8 * u, 3 * u, OUTLINE);
      px(ctx, gx(6), gy(2), 6 * u, u, cloth.base);
      px(ctx, gx(6), gy(1), 6 * u, u, cloth.light);
      px(ctx, gx(11), gy(3), 4 * u, u, OUTLINE); // peak
      px(ctx, gx(11), gy(3), 3 * u, u, cloth.shade);
      break;
    case "hood":
      px(ctx, gx(4), gy(1), 10 * u, 8 * u, OUTLINE);
      px(ctx, gx(5), gy(2), 8 * u, 3 * u, cloth.shade);
      px(ctx, gx(5), gy(2), 8 * u, u, cloth.base);
      px(ctx, gx(5), gy(5), 2 * u, 4 * u, cloth.shade); // cheek panel
      px(ctx, gx(12), gy(5), u, 4 * u, cloth.shade);
      break;
    case "helmet":
      px(ctx, gx(4), gy(1), 10 * u, 7 * u, OUTLINE);
      px(ctx, gx(5), gy(2), 8 * u, 3 * u, accent.shade);
      px(ctx, gx(5), gy(2), 8 * u, u, accent.light);
      px(ctx, gx(5), gy(5), 3 * u, 3 * u, accent.shade); // cheek guard
      px(ctx, gx(12), gy(5), u, 3 * u, accent.shade);
      px(ctx, gx(8), gy(1), 2 * u, u, accent.light); // crest
      break;
    case "band":
      px(ctx, gx(5), gy(2), 8 * u, 2 * u, OUTLINE);
      px(ctx, gx(5), gy(2), 8 * u, u, accent.base);
      px(ctx, gx(12), gy(2), 2 * u, 3 * u, accent.shade); // tail
      break;
    case "tophat":
      px(ctx, gx(4), gy(0), 10 * u, 2 * u, OUTLINE); // brim
      px(ctx, gx(5), gy(0), 8 * u, u, cloth.shade);
      px(ctx, gx(6), gy(-4), 6 * u, 5 * u, OUTLINE);
      px(ctx, gx(7), gy(-3), 4 * u, 4 * u, cloth.base);
      px(ctx, gx(7), gy(-3), 2 * u, 4 * u, cloth.light);
      px(ctx, gx(7), gy(-1), 4 * u, u, accent.base); // ribbon
      break;
    case "visor":
      px(ctx, gx(5), gy(1), 8 * u, 2 * u, OUTLINE);
      px(ctx, gx(5), gy(1), 8 * u, u, hair.shade);
      px(ctx, gx(8), gy(4), 6 * u, 2 * u, OUTLINE); // lens
      px(ctx, gx(9), gy(4), 4 * u, u, accent.light);
      break;
    case "none":
    default:
      break;
  }
}

function drawCrown(ctx: Ctx, x: number, y: number, u: number) {
  px(ctx, x, y - 3 * u, 6 * u, 3 * u, OUTLINE);
  px(ctx, x + u, y - 2 * u, 4 * u, 2 * u, "#f4c542");
  px(ctx, x + u, y - 3 * u, u, u, "#ffe18a");
  px(ctx, x + 3 * u, y - 4 * u, u, 2 * u, "#ffe18a");
  px(ctx, x + 5 * u - u, y - 3 * u, u, u, "#ffe18a");
}

/** Sprite footprint, for hit-testing and layout. */
export function characterSize(unit: number): { width: number; height: number } {
  return { width: SPRITE_W * unit, height: SPRITE_H * unit };
}
