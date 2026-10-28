/**
 * Three-layer land model — pure functions, no database access.
 *
 * The planet moved from normalized territory *shares* to absolute *cells*.
 * A share dilutes: three brands pay at once and nobody's territory visibly
 * grows, which kills the purchase feedback loop. A cell is a concrete object
 * that one brand owns and another can contest.
 *
 * Layers:
 *   CAPITAL  — ring 0, never purchasable, the visual anchor of the arena.
 *   CORE     — rings 1..coreRadius. Finite, never expands. All contests happen
 *              here, so scarcity is permanent and always felt.
 *   FRONTIER — rings beyond core. Expands by one ring when occupancy passes a
 *              threshold, so a newcomer always has somewhere to land — but on
 *              the dull outskirts, which creates the pull inward.
 */

import { hexDistance, hexSpiral, type Hex } from "@/lib/hex";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";

export const CORE_RADIUS_DEFAULT = 2;
export const FRONTIER_RADIUS_DEFAULT = 4;

/** Occupancy above which the frontier grows by one ring. */
export const FRONTIER_EXPAND_THRESHOLD = 0.85;
/** Hard ceiling so an arena cannot grow without bound. */
export const FRONTIER_RADIUS_MAX = 9;

/** Days a held cell survives without any upkeep payment before it starts fading. */
export const UPKEEP_PERIOD_DAYS = 30;
/** Grace period after fading starts, during which the owner can still return. */
export const FADING_GRACE_DAYS = 7;

/** Default siege window length. */
export const CONTEST_WINDOW_HOURS = 6;
/** A contest never closes sooner than this, even when aligned to prime time. */
export const CONTEST_MIN_HOURS = 1;
/** Almaty is UTC+5; 20:00 local prime time is 15:00 UTC. */
export const PRIME_TIME_UTC_HOUR = 15;

export type CellLayerName = "CAPITAL" | "CORE" | "FRONTIER";

export type CellPlan = {
  q: number;
  r: number;
  ring: number;
  layer: CellLayerName;
  priceKzt: number;
};

export const ARENA_CENTER: Hex = { q: 0, r: 0 };

/**
 * Price gradient from the capital outward. A cell next to the capital and a
 * cell on the far frontier should not cost the same — the gradient is what
 * creates a real decision ("save for one central cell or take three cheap
 * ones") and gives an upper price shelf without raising the entry threshold.
 */
export function cellPriceKzt(ring: number, coreRadius: number): number {
  if (ring <= 0) return 0; // capital is not for sale
  if (ring <= coreRadius) {
    const stepsFromEdge = coreRadius + 1 - ring;
    return TERRITORY_CELL_PRICE_KZT * (1 + stepsFromEdge);
  }
  return TERRITORY_CELL_PRICE_KZT;
}

export function layerForRing(ring: number, coreRadius: number): CellLayerName {
  if (ring === 0) return "CAPITAL";
  return ring <= coreRadius ? "CORE" : "FRONTIER";
}

/** Total cells in a hex disc of the given radius: 3r² + 3r + 1. */
export function cellCountForRadius(radius: number): number {
  return 3 * radius * radius + 3 * radius + 1;
}

/**
 * Full cell layout for an arena. Deterministic: the same radii always produce
 * the same grid, so regenerating is safe and idempotent.
 */
export function generateCellPlan(
  coreRadius: number,
  frontierRadius: number,
): CellPlan[] {
  const radius = Math.max(coreRadius, frontierRadius);
  return hexSpiral(ARENA_CENTER, radius).map((hex) => {
    const ring = hexDistance(ARENA_CENTER, hex);
    return {
      q: hex.q,
      r: hex.r,
      ring,
      layer: layerForRing(ring, coreRadius),
      priceKzt: cellPriceKzt(ring, coreRadius),
    };
  });
}

/** Only the cells added by growing from `fromRadius` to `toRadius`. */
export function generateExpansionPlan(
  coreRadius: number,
  fromRadius: number,
  toRadius: number,
): CellPlan[] {
  if (toRadius <= fromRadius) return [];
  return generateCellPlan(coreRadius, toRadius).filter(
    (cell) => cell.ring > fromRadius,
  );
}

export function occupancyRatio(claimable: number, occupied: number): number {
  if (claimable <= 0) return 0;
  return occupied / claimable;
}

export function shouldExpandFrontier(
  claimable: number,
  occupied: number,
  currentRadius: number,
): boolean {
  if (currentRadius >= FRONTIER_RADIUS_MAX) return false;
  return occupancyRatio(claimable, occupied) >= FRONTIER_EXPAND_THRESHOLD;
}

/**
 * Territory share is now derived from cells actually held, not from money.
 * Money still decides *who wins a cell*; the map only ever shows real land.
 */
export function territoryShareFromCells(
  cellsHeld: number,
  claimableCells: number,
): number {
  if (claimableCells <= 0) return 0;
  return cellsHeld / claimableCells;
}

export function upkeepDueAt(lastUpkeepAt: Date): Date {
  return new Date(lastUpkeepAt.getTime() + UPKEEP_PERIOD_DAYS * 86_400_000);
}

export function fadingExpiresAt(fadingSince: Date): Date {
  return new Date(fadingSince.getTime() + FADING_GRACE_DAYS * 86_400_000);
}

/**
 * Round a contest close time up to the next daily prime time, so windows
 * resolve at a predictable hour and the planet gets appointment viewing
 * instead of contests ending at random minutes nobody is watching.
 */
export function alignToPrimeTime(
  from: Date,
  minHours = CONTEST_MIN_HOURS,
  primeHourUtc = PRIME_TIME_UTC_HOUR,
): Date {
  const earliest = new Date(from.getTime() + minHours * 3_600_000);
  const candidate = new Date(
    Date.UTC(
      earliest.getUTCFullYear(),
      earliest.getUTCMonth(),
      earliest.getUTCDate(),
      primeHourUtc,
      0,
      0,
      0,
    ),
  );
  if (candidate.getTime() < earliest.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

export function contestCloseAt(
  from: Date,
  options: { primeTime?: boolean; windowHours?: number } = {},
): Date {
  if (options.primeTime) return alignToPrimeTime(from);
  const hours = options.windowHours ?? CONTEST_WINDOW_HOURS;
  return new Date(from.getTime() + hours * 3_600_000);
}

/**
 * Minimum a challenger must stake to open a contest: the cell's list price, or
 * enough to at least match what the incumbent has sunk into it — whichever is
 * higher. Prevents opening a siege on an expensive cell with a token amount.
 */
export function minChallengeKzt(priceKzt: number, investedKzt: number): number {
  return Math.max(priceKzt, Math.ceil(investedKzt * 0.5), TERRITORY_CELL_PRICE_KZT);
}

/**
 * Ties go to the defender. A challenger must strictly exceed the defence —
 * incumbency is worth something, and it makes the closing number unambiguous.
 */
export function contestWinner(
  challengerKzt: number,
  defenderKzt: number,
): "CHALLENGER" | "DEFENDER" {
  return challengerKzt > defenderKzt ? "CHALLENGER" : "DEFENDER";
}
