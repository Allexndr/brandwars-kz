/**
 * Nested competition scopes — pure catalogue, no database access.
 *
 * The revenue and SEO multiplier is not the number of categories, it is the
 * nesting. The same 24 continents inside world / country / city give hundreds
 * of sellable "#1" positions instead of 24, and each one is an indexable page
 * with genuinely changing content.
 *
 * A city stays closed until enough brands justify its own map. Opening empty
 * city pages up front is exactly the programmatic-SEO junk search engines
 * learned to discard, so `openAtBrands` gates them.
 */

export type ScopeKindName = "WORLD" | "COUNTRY" | "CITY";

export type ScopeDefinition = {
  slug: string;
  kind: ScopeKindName;
  nameRu: string;
  nameKk: string;
  /**
   * Fictional name used on the map.
   *
   * The planet is deliberately not Earth: continents are markets, not
   * geography, and a real country name on the map made it read as a political
   * map of a place. Real names stay on the leaderboard and the geo landing
   * pages, where "лучший бренд в Алматы" is an actual search query worth
   * ranking for — the fiction is the world, not the SEO surface.
   */
  realmRu?: string;
  realmKk?: string;
  parentSlug: string | null;
  /** Brands needed in the parent scope before this one opens. */
  openAtBrands: number;
  /** Open from the start, without waiting for the brand threshold. */
  openImmediately?: boolean;
  /**
   * Whether this scope owns a real grid of cells.
   *
   * Countries and cities do — that is where land is bought. The world tier does
   * NOT: its leader is derived by aggregating cells across every country, so a
   * brand is never asked to pay twice for the same continent.
   */
  hasArena: boolean;
};

export const WORLD_SLUG = "world";
export const DEFAULT_COUNTRY_SLUG = "kz";

/**
 * Cities carry the country prefix so adding a second country cannot collide
 * (`kz-almaty` vs a future `uz-tashkent`).
 */
export const SCOPE_CATALOG: ScopeDefinition[] = [
  {
    slug: WORLD_SLUG,
    kind: "WORLD",
    nameRu: "Планета",
    nameKk: "Планета",
    realmRu: "Брендиум",
    realmKk: "Брендиум",
    parentSlug: null,
    openAtBrands: 0,
    openImmediately: true,
    hasArena: false, // derived from all countries
  },
  {
    slug: DEFAULT_COUNTRY_SLUG,
    kind: "COUNTRY",
    nameRu: "Казахстан",
    nameKk: "Қазақстан",
    realmRu: "Великая Степь",
    realmKk: "Ұлы Дала",
    parentSlug: WORLD_SLUG,
    openAtBrands: 0,
    openImmediately: true,
    hasArena: true,
  },

  // Cities open as density arrives. Thresholds rise with city size, because a
  // map with two brands on it is not a competition worth showing.
  city("almaty", "Алматы", "Алматы", 8),
  city("astana", "Астана", "Астана", 8),
  city("shymkent", "Шымкент", "Шымкент", 6),
  city("karaganda", "Караганда", "Қарағанды", 5),
  city("aktobe", "Актобе", "Ақтөбе", 5),
  city("taraz", "Тараз", "Тараз", 5),
  city("pavlodar", "Павлодар", "Павлодар", 5),
  city("oskemen", "Усть-Каменогорск", "Өскемен", 5),
  city("semey", "Семей", "Семей", 5),
  city("atyrau", "Атырау", "Атырау", 5),
  city("kostanay", "Костанай", "Қостанай", 5),
  city("kyzylorda", "Кызылорда", "Қызылорда", 5),
  city("oral", "Уральск", "Орал", 5),
  city("aktau", "Актау", "Ақтау", 5),
  city("turkestan", "Туркестан", "Түркістан", 5),
];

function city(
  slug: string,
  nameRu: string,
  nameKk: string,
  openAtBrands: number,
): ScopeDefinition {
  return {
    slug: `${DEFAULT_COUNTRY_SLUG}-${slug}`,
    kind: "CITY",
    nameRu,
    nameKk,
    parentSlug: DEFAULT_COUNTRY_SLUG,
    openAtBrands,
    hasArena: true,
  };
}

/** Scopes that get a real grid of cells from day one. */
export function baseArenaScopeSlugs(): string[] {
  return SCOPE_CATALOG.filter(
    (scope) => scope.openImmediately && scope.hasArena,
  ).map((scope) => scope.slug);
}

/** Scopes whose leaderboard is computed by aggregating child scopes. */
export function derivedScopeSlugs(): string[] {
  return SCOPE_CATALOG.filter((scope) => !scope.hasArena).map(
    (scope) => scope.slug,
  );
}

export function findScope(slug: string): ScopeDefinition | undefined {
  return SCOPE_CATALOG.find((scope) => scope.slug === slug);
}

export function childScopes(parentSlug: string): ScopeDefinition[] {
  return SCOPE_CATALOG.filter((scope) => scope.parentSlug === parentSlug);
}

export function scopeName(scope: ScopeDefinition, locale: string): string {
  return locale === "kk" ? scope.nameKk : scope.nameRu;
}

/** Name for the map. Falls back to the real name when no fiction is defined. */
export function scopeRealmName(
  scope: { realmRu?: string; realmKk?: string; nameRu: string; nameKk: string },
  locale: string,
): string {
  if (locale === "kk") return scope.realmKk ?? scope.nameKk;
  return scope.realmRu ?? scope.nameRu;
}

/** Map-side name looked up by slug, for callers that only have the slug. */
export function realmNameBySlug(slug: string, locale: string): string | null {
  const scope = SCOPE_CATALOG.find((item) => item.slug === slug);
  return scope ? scopeRealmName(scope, locale) : null;
}

/**
 * How many "#1" positions the current configuration can sell: every
 * (category x open scope) pair has exactly one leader.
 */
export function sellableLeaderSlots(
  categoryCount: number,
  openScopeCount: number,
): number {
  return categoryCount * openScopeCount;
}
