/**
 * Themed objects the representatives lob at each other across the attention
 * line.
 *
 * Deliberately never weapons: a travel brand throws suitcases and paper planes,
 * a beauty brand throws lipsticks, a finance brand throws coins. The exchange
 * reads as a friendly food fight, which is what keeps the whole product clear
 * of "brand X attacks brand Y" framing while still looking like a contest.
 *
 * Pure canvas drawing, no state — every projectile's position is derived from
 * the clock and its index, so a crowd of them costs nothing to track.
 */

export type ProjectileKind =
  | "plane"
  | "suitcase"
  | "ticket"
  | "drink"
  | "lipstick"
  | "brush"
  | "bottle"
  | "laptop"
  | "packet"
  | "bracket"
  | "bot"
  | "coin"
  | "card"
  | "flask"
  | "dumbbell"
  | "box"
  | "envelope"
  | "shield"
  | "key"
  | "megaphone"
  | "chart"
  | "joystick"
  | "dice"
  | "cup"
  | "bag"
  | "book";

/** Two to four objects per continent, so a volley never looks repetitive. */
export const PROJECTILE_SETS: Record<string, ProjectileKind[]> = {
  travel: ["plane", "suitcase", "ticket", "drink"],
  beauty: ["lipstick", "brush", "bottle"],
  code: ["laptop", "packet", "bracket"],
  "ai-agents": ["bot", "packet", "bracket"],
  finance: ["coin", "card", "box"],
  health: ["flask", "dumbbell", "bottle"],
  logistics: ["box", "envelope", "plane"],
  security: ["shield", "key", "packet"],
  marketing: ["megaphone", "chart", "envelope"],
  media: ["megaphone", "ticket", "envelope"],
  games: ["joystick", "dice", "cup"],
  education: ["book", "ticket", "bracket"],
  food: ["cup", "box", "drink"],
  retail: ["bag", "box", "ticket"],
  fashion: ["bag", "lipstick", "ticket"],
  fitness: ["dumbbell", "cup", "bottle"],
  "real-estate": ["key", "box", "chart"],
  auto: ["key", "box", "coin"],
  telecom: ["packet", "bot", "envelope"],
  events: ["ticket", "cup", "megaphone"],
  home: ["box", "key", "brush"],
  agro: ["box", "bottle", "bag"],
  b2b: ["envelope", "chart", "card"],
  other: ["box", "ticket", "packet"],
};

export function projectilesFor(categorySlug: string): ProjectileKind[] {
  return PROJECTILE_SETS[categorySlug] ?? PROJECTILE_SETS.other;
}

const OUTLINE = "#141a2e";

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

/**
 * Draw one object centred on the origin, already rotated by the caller.
 *
 * `accent` lets a projectile pick up the throwing brand's colour, so a volley
 * visibly belongs to one side.
 */
export function drawProjectile(
  ctx: Ctx,
  kind: ProjectileKind,
  x: number,
  y: number,
  rotation: number,
  scale: number,
  accent: string,
) {
  const u = Math.max(1, Math.round(scale));

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(rotation);

  switch (kind) {
    case "plane":
      // Paper plane: body plus one wing, dark underside for volume.
      px(ctx, -5 * u, -2 * u, 10 * u, 4 * u, OUTLINE);
      px(ctx, -4 * u, -1 * u, 8 * u, 2 * u, "#f7f9fc");
      px(ctx, -1 * u, -4 * u, 4 * u, 2 * u, OUTLINE);
      px(ctx, 0, -3 * u, 2 * u, u, accent);
      break;

    case "suitcase":
      px(ctx, -5 * u, -4 * u, 10 * u, 8 * u, OUTLINE);
      px(ctx, -4 * u, -3 * u, 8 * u, 6 * u, accent);
      px(ctx, -4 * u, -3 * u, 8 * u, 2 * u, "#ffffff44");
      px(ctx, -1 * u, -6 * u, 2 * u, 2 * u, OUTLINE); // handle
      px(ctx, -4 * u, 0, 8 * u, u, OUTLINE); // strap
      break;

    case "ticket":
      px(ctx, -6 * u, -3 * u, 12 * u, 6 * u, OUTLINE);
      px(ctx, -5 * u, -2 * u, 10 * u, 4 * u, "#f8df75");
      px(ctx, -1 * u, -2 * u, u, 4 * u, OUTLINE); // perforation
      break;

    case "drink":
      px(ctx, -3 * u, -4 * u, 6 * u, 8 * u, OUTLINE);
      px(ctx, -2 * u, -3 * u, 4 * u, 6 * u, "#7ad3e8");
      px(ctx, -2 * u, -3 * u, 4 * u, u, "#ffffff66");
      px(ctx, u, -6 * u, u, 3 * u, accent); // straw
      break;

    case "lipstick":
      px(ctx, -2 * u, -5 * u, 4 * u, 10 * u, OUTLINE);
      px(ctx, -1 * u, -4 * u, 2 * u, 4 * u, "#e8467f");
      px(ctx, -1 * u, 0, 2 * u, 4 * u, accent);
      break;

    case "brush":
      px(ctx, -1 * u, -6 * u, 2 * u, 12 * u, OUTLINE);
      px(ctx, -1 * u, -5 * u, u, 10 * u, accent);
      px(ctx, -2 * u, 3 * u, 4 * u, 3 * u, OUTLINE);
      px(ctx, -1 * u, 4 * u, 2 * u, 2 * u, "#f0d7b8");
      break;

    case "bottle":
      px(ctx, -3 * u, -5 * u, 6 * u, 10 * u, OUTLINE);
      px(ctx, -2 * u, -2 * u, 4 * u, 6 * u, accent);
      px(ctx, -1 * u, -5 * u, 2 * u, 3 * u, OUTLINE);
      px(ctx, -2 * u, -1 * u, u, 4 * u, "#ffffff55");
      break;

    case "laptop":
      px(ctx, -6 * u, -4 * u, 12 * u, 8 * u, OUTLINE);
      px(ctx, -5 * u, -3 * u, 10 * u, 4 * u, "#cfe6f5");
      px(ctx, -5 * u, 2 * u, 10 * u, 2 * u, accent);
      break;

    case "packet":
      px(ctx, -4 * u, -4 * u, 8 * u, 8 * u, OUTLINE);
      px(ctx, -3 * u, -3 * u, 6 * u, 6 * u, accent);
      px(ctx, -1 * u, -1 * u, 2 * u, 2 * u, "#bfeeff");
      break;

    case "bracket":
      px(ctx, -5 * u, -5 * u, 3 * u, u, accent);
      px(ctx, -5 * u, -5 * u, u, 10 * u, accent);
      px(ctx, -5 * u, 4 * u, 3 * u, u, accent);
      px(ctx, 2 * u, -5 * u, 3 * u, u, accent);
      px(ctx, 4 * u, -5 * u, u, 10 * u, accent);
      px(ctx, 2 * u, 4 * u, 3 * u, u, accent);
      break;

    case "bot":
      px(ctx, -4 * u, -4 * u, 8 * u, 8 * u, OUTLINE);
      px(ctx, -3 * u, -3 * u, 6 * u, 6 * u, accent);
      px(ctx, -2 * u, -2 * u, 2 * u, 2 * u, "#f7f9fc");
      px(ctx, u, -2 * u, 2 * u, 2 * u, "#f7f9fc");
      px(ctx, -1 * u, -6 * u, 2 * u, 2 * u, OUTLINE); // antenna
      break;

    case "coin":
      px(ctx, -4 * u, -4 * u, 8 * u, 8 * u, OUTLINE);
      px(ctx, -3 * u, -3 * u, 6 * u, 6 * u, "#f4c542");
      px(ctx, -1 * u, -2 * u, 2 * u, 4 * u, "#b08a24");
      break;

    case "card":
      px(ctx, -6 * u, -4 * u, 12 * u, 8 * u, OUTLINE);
      px(ctx, -5 * u, -3 * u, 10 * u, 6 * u, accent);
      px(ctx, -5 * u, -1 * u, 10 * u, 2 * u, "#1f2937");
      break;

    case "flask":
      px(ctx, -3 * u, -5 * u, 6 * u, 10 * u, OUTLINE);
      px(ctx, -2 * u, 0, 4 * u, 4 * u, "#5fd6a8");
      px(ctx, -1 * u, -5 * u, 2 * u, 5 * u, "#e8eef0");
      break;

    case "dumbbell":
      px(ctx, -6 * u, -2 * u, 12 * u, 4 * u, OUTLINE);
      px(ctx, -6 * u, -3 * u, 3 * u, 6 * u, accent);
      px(ctx, 3 * u, -3 * u, 3 * u, 6 * u, accent);
      px(ctx, -2 * u, -1 * u, 4 * u, 2 * u, "#94a3b8");
      break;

    case "box":
      px(ctx, -5 * u, -4 * u, 10 * u, 8 * u, OUTLINE);
      px(ctx, -4 * u, -3 * u, 8 * u, 6 * u, "#c98a4b");
      px(ctx, -1 * u, -3 * u, 2 * u, 6 * u, accent); // tape
      break;

    case "envelope":
      px(ctx, -6 * u, -4 * u, 12 * u, 8 * u, OUTLINE);
      px(ctx, -5 * u, -3 * u, 10 * u, 6 * u, "#f7f9fc");
      px(ctx, -5 * u, -3 * u, 5 * u, 3 * u, accent);
      px(ctx, 0, -3 * u, 5 * u, 3 * u, accent);
      break;

    case "shield":
      px(ctx, -4 * u, -5 * u, 8 * u, 8 * u, OUTLINE);
      px(ctx, -3 * u, -4 * u, 6 * u, 6 * u, accent);
      px(ctx, -2 * u, 3 * u, 4 * u, 2 * u, OUTLINE);
      px(ctx, -1 * u, -2 * u, 2 * u, 3 * u, "#ffffff77");
      break;

    case "key":
      px(ctx, -5 * u, -2 * u, 4 * u, 4 * u, OUTLINE);
      px(ctx, -4 * u, -1 * u, 2 * u, 2 * u, "#f4c542");
      px(ctx, -1 * u, -1 * u, 6 * u, 2 * u, "#f4c542");
      px(ctx, 3 * u, u, 2 * u, 2 * u, "#f4c542");
      break;

    case "megaphone":
      px(ctx, -5 * u, -3 * u, 4 * u, 6 * u, OUTLINE);
      px(ctx, -1 * u, -5 * u, 6 * u, 10 * u, OUTLINE);
      px(ctx, 0, -4 * u, 4 * u, 8 * u, accent);
      px(ctx, -4 * u, -2 * u, 2 * u, 4 * u, "#94a3b8");
      break;

    case "chart":
      px(ctx, -5 * u, -5 * u, 10 * u, 10 * u, OUTLINE);
      px(ctx, -4 * u, -4 * u, 8 * u, 8 * u, "#f7f9fc");
      px(ctx, -3 * u, 0, 2 * u, 3 * u, accent);
      px(ctx, 0, -2 * u, 2 * u, 5 * u, accent);
      px(ctx, 2 * u, -3 * u, 2 * u, 6 * u, accent);
      break;

    case "joystick":
      px(ctx, -5 * u, -1 * u, 10 * u, 5 * u, OUTLINE);
      px(ctx, -4 * u, 0, 8 * u, 3 * u, accent);
      px(ctx, -1 * u, -4 * u, 2 * u, 3 * u, OUTLINE);
      px(ctx, -2 * u, -5 * u, 4 * u, 2 * u, "#e8467f");
      break;

    case "dice":
      px(ctx, -4 * u, -4 * u, 8 * u, 8 * u, OUTLINE);
      px(ctx, -3 * u, -3 * u, 6 * u, 6 * u, "#f7f9fc");
      px(ctx, -2 * u, -2 * u, u, u, OUTLINE);
      px(ctx, u, u, u, u, OUTLINE);
      px(ctx, -1 * u, -1 * u, u, u, OUTLINE);
      break;

    case "cup":
      px(ctx, -3 * u, -4 * u, 6 * u, 8 * u, OUTLINE);
      px(ctx, -2 * u, -3 * u, 4 * u, 6 * u, accent);
      px(ctx, -2 * u, -3 * u, 4 * u, u, "#f7f9fc");
      px(ctx, 3 * u, -2 * u, 2 * u, 3 * u, OUTLINE); // handle
      break;

    case "bag":
      px(ctx, -4 * u, -3 * u, 8 * u, 8 * u, OUTLINE);
      px(ctx, -3 * u, -2 * u, 6 * u, 6 * u, accent);
      px(ctx, -2 * u, -5 * u, u, 3 * u, OUTLINE);
      px(ctx, u, -5 * u, u, 3 * u, OUTLINE);
      break;

    case "book":
      px(ctx, -5 * u, -4 * u, 10 * u, 8 * u, OUTLINE);
      px(ctx, -4 * u, -3 * u, 4 * u, 6 * u, accent);
      px(ctx, u, -3 * u, 3 * u, 6 * u, "#f7f9fc");
      px(ctx, 0, -3 * u, u, 6 * u, OUTLINE); // spine
      break;
  }

  ctx.restore();
}

export type Flight = {
  kind: ProjectileKind;
  x: number;
  y: number;
  rotation: number;
  /** 1 = left side threw it, -1 = right side. */
  direction: 1 | -1;
  /** 0..1 across the arc; 1 means it just landed. */
  progress: number;
};

/**
 * Positions of every object currently in the air.
 *
 * Each projectile gets its own period and phase offset from its index, so the
 * volley looks continuous and uncoordinated without storing any state. Both
 * sides throw: even indices go left-to-right, odd ones come back.
 */
export function volley(params: {
  time: number;
  count: number;
  kinds: ProjectileKind[];
  leftX: number;
  rightX: number;
  groundY: number;
  arcHeight: number;
}): Flight[] {
  const flights: Flight[] = [];
  const { time, count, kinds, leftX, rightX, groundY, arcHeight } = params;

  for (let i = 0; i < count; i++) {
    const direction: 1 | -1 = i % 2 === 0 ? 1 : -1;
    // Varying periods keep throws from lining up into a single pulse.
    const period = 2.4 + (i % 3) * 0.7;
    const phase = (i * 0.37) % 1;
    const progress = ((time / period + phase) % 1 + 1) % 1;

    const fromX = direction === 1 ? leftX : rightX;
    const toX = direction === 1 ? rightX : leftX;

    const x = fromX + (toX - fromX) * progress;
    // A parabola, so the object rises and falls instead of sliding.
    const y = groundY - Math.sin(progress * Math.PI) * arcHeight;

    flights.push({
      kind: kinds[i % kinds.length],
      x,
      y,
      // Tumbling in the direction of travel.
      rotation: time * 2.2 * direction + i,
      direction,
      progress,
    });
  }

  return flights;
}
