/**
 * Post copy for the autoposting bot — pure functions, no database.
 *
 * Two constraints are baked in here rather than left to whoever writes the
 * templates later:
 *
 * 1. Naming a brand in our own social post is advertising use of that brand's
 *    name. On the platform itself a rank display is covered by the terms the
 *    participant accepted; a promotional post is not. So only paying
 *    participants may ever be named — a non-participant appearing in a post is
 *    exactly the discreditation exposure the whole opt-in design exists to
 *    avoid (Entrepreneurial Code arts. 181 / 191).
 *
 * 2. The wording stays sporting. The Supreme Court's normative resolution No. 3
 *    of 20 May 2026 protects value judgements and rhetoric, but only while they
 *    assert nothing false about the brand. "Took the territory" describes a real
 *    paid transaction; "worse", "loser", "best brand in Kazakhstan" do not.
 */

export const POST_MAX_CHARS = 500;

/** Always appended, and doubles as the required advertising marker. */
export const SIGNATURE = "Своя территория на карте — от 1 000 ₸ · brandwars.kz";

/**
 * Claims we must never make. Checked against the finished text, because brand
 * names are user-supplied and a template is not the only way bad copy appears.
 */
const FORBIDDEN = [
  "лучший бренд",
  "лучше чем",
  "хуже",
  "проиграл",
  "проиграла",
  "слабак",
  "отстой",
  "не справил",
  "обошла по качеству",
  "обошёл по качеству",
  "худший",
  "аутсайдер",
  "неудачник",
  "по качеству",
  "качественнее",
  "надёжнее",
  "дешевле",
];

export type CopyCheck =
  | { ok: true }
  | { ok: false; reason: "forbidden_claim" | "too_long"; detail: string };

export function checkCopy(text: string): CopyCheck {
  const lowered = text.toLowerCase();
  for (const phrase of FORBIDDEN) {
    if (lowered.includes(phrase)) {
      return { ok: false, reason: "forbidden_claim", detail: phrase };
    }
  }
  if (text.length > POST_MAX_CHARS) {
    return { ok: false, reason: "too_long", detail: `${text.length}` };
  }
  return { ok: true };
}

function kzt(amount: number): string {
  return `${amount.toLocaleString("ru-KZ")} ₸`;
}

/**
 * Russian plural agreement. Template-generated text that says "2 клеток"
 * reads as machine output, and these posts are the public voice of the product.
 */
export function plural(n: number, forms: [string, string, string]): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export const CELLS: [string, string, string] = ["клетка", "клетки", "клеток"];
const BRANDS: [string, string, string] = ["бренд", "бренда", "брендов"];
const TRANSITIONS: [string, string, string] = ["переход", "перехода", "переходов"];

/**
 * Continent names are proper nouns that would need declension in most phrasings
 * ("в Травелии", "столицу Травелии"). A colon prefix keeps every template in the
 * nominative, which is the only form we can generate correctly.
 */
function continentPrefix(continent: string): string {
  return `«${continent}»`;
}

export type BrandRef = {
  id: string;
  name: string;
  /** False means this brand must not be named in a post. */
  isParticipant: boolean;
};

export type PostDraft = {
  kind:
    | "leader_change"
    | "contest_opened"
    | "contest_resolved"
    | "land_released"
    | "digest";
  dedupeKey: string;
  priority: number;
  text: string;
  linkPath: string;
  brandIds: string[];
};

/**
 * Every draft goes through here. A draft naming a non-participant is dropped
 * rather than sanitised — silently rewriting it would hide the bug that
 * produced it.
 */
export function finalizeDraft(
  draft: Omit<PostDraft, "text"> & { body: string },
  brands: BrandRef[],
): PostDraft | null {
  if (brands.some((brand) => !brand.isParticipant)) return null;

  const text = `${draft.body.trim()}\n\n${SIGNATURE}`;
  const check = checkCopy(text);
  if (!check.ok) return null;

  return {
    kind: draft.kind,
    dedupeKey: draft.dedupeKey,
    priority: draft.priority,
    text,
    linkPath: draft.linkPath,
    brandIds: draft.brandIds,
  };
}

export function leaderChangeDraft(params: {
  continent: string;
  categorySlug: string;
  newLeader: BrandRef;
  previousLeader: BrandRef | null;
  newAmountKzt: number;
  previousAmountKzt: number;
  cellCount: number;
  totalCells: number;
  takePlaceKzt: number;
  seasonDay: string;
}): PostDraft | null {
  const brands = [params.newLeader, ...(params.previousLeader ? [params.previousLeader] : [])];

  const lines = [
    `🏆 ${continentPrefix(params.continent)}: ${params.newLeader.name} — новый лидер материка.`,
    "",
  ];

  if (params.previousLeader) {
    lines.push(`Было: ${params.previousLeader.name} — ${kzt(params.previousAmountKzt)}`);
  }
  lines.push(`Стало: ${params.newLeader.name} — ${kzt(params.newAmountKzt)}`);
  lines.push("");
  lines.push(
    `Территория: ${params.cellCount} из ${params.totalCells} ${plural(params.totalCells, CELLS)}.`,
  );
  lines.push(`Место #1 можно перекрыть за ${kzt(params.takePlaceKzt)}.`);

  return finalizeDraft(
    {
      kind: "leader_change",
      // Keyed on the day so a leader who flips back and forth still gets one
      // post per flip, not one per recalculation.
      dedupeKey: `leader:${params.categorySlug}:${params.newLeader.id}:${params.seasonDay}`,
      priority: 100,
      body: lines.join("\n"),
      linkPath: `/category/${params.categorySlug}`,
      brandIds: brands.map((b) => b.id),
    },
    brands,
  );
}

export function contestOpenedDraft(params: {
  contestId: string;
  continent: string;
  categorySlug: string;
  challenger: BrandRef;
  defender: BrandRef;
  challengerKzt: number;
  defenderKzt: number;
  hoursLeft: number;
}): PostDraft | null {
  const brands = [params.challenger, params.defender];

  const body = [
    `⏳ ${continentPrefix(params.continent)}: ${params.challenger.name} претендует на клетку ${params.defender.name}.`,
    "",
    `${params.challenger.name}: ${kzt(params.challengerKzt)}`,
    `${params.defender.name}: ${kzt(params.defenderKzt)}`,
    `До закрытия окна: ${params.hoursLeft} ч`,
    "",
    `При равных суммах клетка остаётся у ${params.defender.name}.`,
  ].join("\n");

  return finalizeDraft(
    {
      kind: "contest_opened",
      dedupeKey: `contest_open:${params.contestId}`,
      priority: 80,
      body,
      linkPath: `/category/${params.categorySlug}`,
      brandIds: brands.map((b) => b.id),
    },
    brands,
  );
}

export function contestResolvedDraft(params: {
  contestId: string;
  continent: string;
  categorySlug: string;
  winner: BrandRef;
  loser: BrandRef;
  challengerWon: boolean;
  challengerKzt: number;
  defenderKzt: number;
}): PostDraft | null {
  const brands = [params.winner, params.loser];

  const headline = params.challengerWon
    ? `🔁 ${continentPrefix(params.continent)}: ${params.winner.name} перекрыла территорию ${params.loser.name}.`
    : `🛡 ${continentPrefix(params.continent)}: ${params.winner.name} удержала клетку.`;

  const body = [
    headline,
    "",
    `Итог окна: ${kzt(params.challengerKzt)} против ${kzt(params.defenderKzt)}.`,
    "",
    // Softens the outcome and states a real platform rule, which keeps the post
    // from reading as a verdict on anybody's business.
    `Ставка проигравшей стороны возвращается на баланс и уходит на другие клетки.`,
  ].join("\n");

  return finalizeDraft(
    {
      kind: "contest_resolved",
      dedupeKey: `contest_done:${params.contestId}`,
      priority: 90,
      body,
      linkPath: `/category/${params.categorySlug}`,
      brandIds: brands.map((b) => b.id),
    },
    brands,
  );
}

/**
 * The strongest selling post, and it names nobody — free land is an offer, not
 * a story about a competitor.
 */
export function landReleasedDraft(params: {
  continent: string;
  categorySlug: string;
  releasedCells: number;
  brandsInArena: number;
  capitalCellKzt: number;
  day: string;
}): PostDraft | null {
  const body = [
    `🟢 ${continentPrefix(params.continent)}: освободилось ${params.releasedCells} ${plural(params.releasedCells, CELLS)}.`,
    "",
    `Вход — от ${kzt(1000)}. Клетка у столицы — ${kzt(params.capitalCellKzt)}.`,
    `Сейчас на материке ${params.brandsInArena} ${plural(params.brandsInArena, BRANDS)}.`,
  ].join("\n");

  return finalizeDraft(
    {
      kind: "land_released",
      dedupeKey: `land:${params.categorySlug}:${params.day}`,
      priority: 60,
      body,
      linkPath: `/category/${params.categorySlug}`,
      brandIds: [],
    },
    [],
  );
}

export type DigestLine = { brand: BrandRef; what: string };

/**
 * Rolls the small stuff into one post. Individual cell claims are noise on
 * their own and would burn the daily budget in an afternoon.
 */
export function digestDraft(params: {
  continent: string;
  categorySlug: string;
  lines: DigestLine[];
  totalKzt: number;
  clicks: number;
  day: string;
  slot: string;
}): PostDraft | null {
  const named = params.lines.filter((line) => line.brand.isParticipant);
  if (named.length === 0) return null;

  const body = [
    `📊 ${continentPrefix(params.continent)} за сутки`,
    "",
    ...named.slice(0, 6).map((line) => `${line.brand.name} ${line.what}`),
    "",
    `Всего вложено: ${kzt(params.totalKzt)} · ${params.clicks} ${plural(params.clicks, TRANSITIONS)} по ссылкам брендов`,
  ].join("\n");

  return finalizeDraft(
    {
      kind: "digest",
      dedupeKey: `digest:${params.categorySlug}:${params.day}:${params.slot}`,
      priority: 40,
      body,
      linkPath: `/category/${params.categorySlug}`,
      brandIds: named.map((line) => line.brand.id),
    },
    named.map((line) => line.brand),
  );
}

/** YYYY-MM-DD in Almaty time, used for dedupe keys and digest slots. */
export function almatyDay(date = new Date()): string {
  const almaty = new Date(date.getTime() + 5 * 3_600_000);
  return almaty.toISOString().slice(0, 10);
}
