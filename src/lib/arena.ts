import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CORE_RADIUS_DEFAULT,
  FRONTIER_RADIUS_DEFAULT,
  FADING_GRACE_DAYS,
  UPKEEP_PERIOD_DAYS,
  generateCellPlan,
  generateExpansionPlan,
  shouldExpandFrontier,
} from "@/lib/land";
import {
  SCOPE_CATALOG,
  WORLD_SLUG,
  baseArenaScopeSlugs,
  childScopes,
} from "@/lib/scopes";

/** Cell states that count as "this brand is on the map here". */
export const OCCUPIED_STATES = ["HELD", "CONTESTED", "FADING"] as const;
type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Upsert the scope tree. Parents are written before children so the self
 * relation always resolves.
 */
export async function ensureScopes(): Promise<void> {
  const ordered = [...SCOPE_CATALOG].sort((a, b) => {
    const rank = (kind: string) =>
      kind === "WORLD" ? 0 : kind === "COUNTRY" ? 1 : 2;
    return rank(a.kind) - rank(b.kind);
  });

  for (let index = 0; index < ordered.length; index++) {
    const scope = ordered[index];
    const parent = scope.parentSlug
      ? await prisma.scope.findUnique({
          where: { slug: scope.parentSlug },
          select: { id: true },
        })
      : null;

    await prisma.scope.upsert({
      where: { slug: scope.slug },
      update: {
        kind: scope.kind,
        nameRu: scope.nameRu,
        nameKk: scope.nameKk,
        parentId: parent?.id ?? null,
        openAtBrands: scope.openAtBrands,
        sortOrder: index,
        ...(scope.openImmediately ? { isOpen: true } : {}),
      },
      create: {
        slug: scope.slug,
        kind: scope.kind,
        nameRu: scope.nameRu,
        nameKk: scope.nameKk,
        parentId: parent?.id ?? null,
        openAtBrands: scope.openAtBrands,
        isOpen: Boolean(scope.openImmediately),
        sortOrder: index,
      },
    });
  }
}

/**
 * Create the arena for a (season-category x scope) pair and fill in its grid.
 * Idempotent — safe to call on every sync.
 */
export async function ensureArena(
  seasonCategoryId: string,
  scopeId: string,
): Promise<string> {
  const arena = await prisma.arena.upsert({
    where: { seasonCategoryId_scopeId: { seasonCategoryId, scopeId } },
    update: {},
    create: {
      seasonCategoryId,
      scopeId,
      coreRadius: CORE_RADIUS_DEFAULT,
      frontierRadius: FRONTIER_RADIUS_DEFAULT,
    },
    select: { id: true, coreRadius: true, frontierRadius: true },
  });

  await ensureArenaCells(arena.id, arena.coreRadius, arena.frontierRadius);
  return arena.id;
}

/**
 * Write the cell grid. `skipDuplicates` makes this a no-op once the grid
 * exists, so it costs one insert attempt rather than a read-then-write.
 */
export async function ensureArenaCells(
  arenaId: string,
  coreRadius: number,
  frontierRadius: number,
): Promise<number> {
  const plan = generateCellPlan(coreRadius, frontierRadius);

  const result = await prisma.cell.createMany({
    data: plan.map((cell) => ({
      arenaId,
      q: cell.q,
      r: cell.r,
      ring: cell.ring,
      layer: cell.layer,
      priceKzt: cell.priceKzt,
      state: "NEUTRAL" as const,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

/** Every arena for the active season, with its grid guaranteed to exist. */
export async function ensureArenasForActiveSeason(): Promise<void> {
  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (!activeSeason) return;

  const [seasonCategories, scopes] = await Promise.all([
    prisma.seasonCategory.findMany({
      where: { seasonId: activeSeason.id },
      select: { id: true },
    }),
    prisma.scope.findMany({
      where: { slug: { in: baseArenaScopeSlugs() } },
      select: { id: true },
    }),
  ]);

  for (const seasonCategory of seasonCategories) {
    for (const scope of scopes) {
      await ensureArena(seasonCategory.id, scope.id);
    }
  }
}

/**
 * Grow the frontier by one ring once the arena is nearly full, so a newcomer
 * always has somewhere to land. The core is untouched: scarcity there is
 * permanent, which is what keeps contests happening.
 */
export async function expandFrontierIfNeeded(
  arenaId: string,
): Promise<boolean> {
  const arena = await prisma.arena.findUnique({
    where: { id: arenaId },
    select: { id: true, coreRadius: true, frontierRadius: true },
  });
  if (!arena) return false;

  const [claimable, occupied] = await Promise.all([
    prisma.cell.count({ where: { arenaId, layer: { not: "CAPITAL" } } }),
    prisma.cell.count({
      where: {
        arenaId,
        layer: { not: "CAPITAL" },
        state: { in: [...OCCUPIED_STATES] },
      },
    }),
  ]);

  if (!shouldExpandFrontier(claimable, occupied, arena.frontierRadius)) {
    return false;
  }

  const nextRadius = arena.frontierRadius + 1;
  const plan = generateExpansionPlan(
    arena.coreRadius,
    arena.frontierRadius,
    nextRadius,
  );

  await prisma.$transaction([
    prisma.cell.createMany({
      data: plan.map((cell) => ({
        arenaId,
        q: cell.q,
        r: cell.r,
        ring: cell.ring,
        layer: cell.layer,
        priceKzt: cell.priceKzt,
        state: "NEUTRAL" as const,
      })),
      skipDuplicates: true,
    }),
    prisma.arena.update({
      where: { id: arenaId },
      data: { frontierRadius: nextRadius },
    }),
    prisma.cellEvent.create({
      data: {
        arenaId,
        type: "FRONTIER_EXPANDED",
        metadata: { fromRadius: arena.frontierRadius, toRadius: nextRadius },
      },
    }),
  ]);

  return true;
}

export type ClaimCellResult =
  | { ok: true; cellId: string; amountKzt: number }
  | { ok: false; reason: "not_found" | "occupied" | "capital" | "underpaid" };

/**
 * Take an unowned cell.
 *
 * The guard is the `updateMany` where-clause: Postgres only matches the row
 * while it is still NEUTRAL, so two simultaneous claims cannot both succeed —
 * the loser gets count 0 and a clean "occupied" result.
 */
export async function claimCell(params: {
  arenaId: string;
  q: number;
  r: number;
  brandId: string;
  userId: string;
  amountKzt: number;
}, db: DbClient = prisma): Promise<ClaimCellResult> {
  const cell = await db.cell.findUnique({
    where: { arenaId_q_r: { arenaId: params.arenaId, q: params.q, r: params.r } },
    select: { id: true, layer: true, state: true, priceKzt: true },
  });

  if (!cell) return { ok: false, reason: "not_found" };
  if (cell.layer === "CAPITAL") return { ok: false, reason: "capital" };
  if (cell.state !== "NEUTRAL") return { ok: false, reason: "occupied" };
  if (params.amountKzt < cell.priceKzt) return { ok: false, reason: "underpaid" };

  const now = new Date();

  const claimed = await db.cell.updateMany({
    where: { id: cell.id, state: "NEUTRAL", ownerBrandId: null },
    data: {
      state: "HELD",
      ownerBrandId: params.brandId,
      claimedAt: now,
      lastUpkeepAt: now,
      fadingSince: null,
      investedKzt: params.amountKzt,
    },
  });

  if (claimed.count === 0) return { ok: false, reason: "occupied" };

  await db.cellEvent.create({
    data: {
      arenaId: params.arenaId,
      cellId: cell.id,
      brandId: params.brandId,
      type: "CLAIMED",
      amountKzt: params.amountKzt,
      metadata: { q: params.q, r: params.r },
    },
  });

  return { ok: true, cellId: cell.id, amountKzt: params.amountKzt };
}

/**
 * Reset a cell's upkeep clock. Also revives a FADING cell — the owner came
 * back inside the grace window, so nothing is lost.
 */
export async function payUpkeep(params: {
  cellId: string;
  brandId: string;
  amountKzt: number;
}, db: DbClient = prisma): Promise<boolean> {
  const now = new Date();

  const updated = await db.cell.updateMany({
    where: {
      id: params.cellId,
      ownerBrandId: params.brandId,
      state: { in: ["HELD", "FADING"] },
    },
    data: {
      state: "HELD",
      lastUpkeepAt: now,
      fadingSince: null,
      investedKzt: { increment: params.amountKzt },
    },
  });

  if (updated.count === 0) return false;

  const cell = await db.cell.findUnique({
    where: { id: params.cellId },
    select: { arenaId: true },
  });

  if (cell) {
    await db.cellEvent.create({
      data: {
        arenaId: cell.arenaId,
        cellId: params.cellId,
        brandId: params.brandId,
        type: "UPKEEP_PAID",
        amountKzt: params.amountKzt,
      },
    });
  }

  return true;
}

export type DecayTickResult = {
  startedFading: number;
  released: number;
};

/**
 * The decay lifecycle, and the reason this product can earn more than once.
 *
 * A one-off cell purchase means one-off revenue: three months in, every good
 * cell belongs to someone who paid once in March, newcomers see a frozen map
 * and existing owners have no reason to pay again. Decay keeps the core
 * contestable and turns land into something you maintain.
 *
 * Framed as fading rather than confiscation: the owner is warned and has a
 * grace window to come back.
 */
export async function runDecayTick(now = new Date()): Promise<DecayTickResult> {
  const upkeepCutoff = new Date(now.getTime() - UPKEEP_PERIOD_DAYS * 86_400_000);
  const graceCutoff = new Date(now.getTime() - FADING_GRACE_DAYS * 86_400_000);

  const staleCells = await prisma.cell.findMany({
    where: {
      state: "HELD",
      lastUpkeepAt: { lt: upkeepCutoff },
    },
    select: { id: true, arenaId: true, ownerBrandId: true },
    take: 500,
  });

  const startedFading = await prisma.$transaction(async (tx) => {
    let changed = 0;
    for (const cell of staleCells) {
      const updated = await tx.cell.updateMany({
        where: {
          id: cell.id,
          state: "HELD",
          lastUpkeepAt: { lt: upkeepCutoff },
        },
        data: { state: "FADING", fadingSince: now },
      });
      if (updated.count === 0) continue;
      changed++;
      await tx.cellEvent.create({
        data: {
          arenaId: cell.arenaId,
          cellId: cell.id,
          brandId: cell.ownerBrandId,
          type: "FADING_STARTED",
          metadata: { graceDays: FADING_GRACE_DAYS },
        },
      });
    }
    return changed;
  });

  const expiredCells = await prisma.cell.findMany({
    where: {
      state: "FADING",
      fadingSince: { lt: graceCutoff },
    },
    select: { id: true, arenaId: true, ownerBrandId: true },
    take: 500,
  });

  const released = await prisma.$transaction(async (tx) => {
    let changed = 0;
    for (const cell of expiredCells) {
      const updated = await tx.cell.updateMany({
        where: {
          id: cell.id,
          state: "FADING",
          fadingSince: { lt: graceCutoff },
        },
        data: {
          state: "NEUTRAL",
          ownerBrandId: null,
          fadingSince: null,
          claimedAt: null,
          lastUpkeepAt: null,
          investedKzt: 0,
        },
      });
      if (updated.count === 0) continue;
      changed++;
      await tx.cellEvent.create({
        data: {
          arenaId: cell.arenaId,
          cellId: cell.id,
          brandId: cell.ownerBrandId,
          type: "RELEASED",
        },
      });
    }
    return changed;
  });

  return {
    startedFading,
    released,
  };
}

/**
 * Open a city once its parent country has enough brands to make a real
 * competition. Empty city maps are the programmatic-SEO junk we are avoiding.
 */
export async function openReadyCityScopes(): Promise<string[]> {
  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (!activeSeason) return [];

  const candidates = childScopes("kz");

  const opened: string[] = [];

  for (const candidate of candidates) {
    const localBrandCount = await prisma.brandClaim.count({
      where: {
        status: "APPROVED",
        brandId: { not: null },
        metadata: {
          path: ["cityScopeSlug"],
          equals: candidate.slug,
        },
      },
    });
    if (localBrandCount < candidate.openAtBrands) continue;

    const scope = await prisma.scope.findUnique({
      where: { slug: candidate.slug },
      select: { id: true, isOpen: true },
    });
    if (!scope || scope.isOpen) continue;

    await prisma.scope.update({
      where: { id: scope.id },
      data: { isOpen: true },
    });

    const seasonCategories = await prisma.seasonCategory.findMany({
      where: { seasonId: activeSeason.id },
      select: { id: true },
    });

    for (const seasonCategory of seasonCategories) {
      await ensureArena(seasonCategory.id, scope.id);
    }

    opened.push(candidate.slug);
  }

  return opened;
}

export type ArenaStanding = {
  brandId: string;
  cellCount: number;
  investedKzt: number;
  rank: number;
};

/**
 * Per-arena standings straight from the cells — one groupBy, so this stays a
 * single query no matter how many brands are in the arena.
 */
export async function arenaStandings(
  arenaId: string,
): Promise<ArenaStanding[]> {
  const rows = await prisma.cell.groupBy({
    by: ["ownerBrandId"],
    where: {
      arenaId,
      state: { in: [...OCCUPIED_STATES] },
      ownerBrandId: { not: null },
    },
    _count: { _all: true },
    _sum: { investedKzt: true },
  });

  return rows
    .map((row) => ({
      brandId: row.ownerBrandId as string,
      cellCount: row._count._all,
      investedKzt: row._sum.investedKzt ?? 0,
    }))
    .sort(
      (a, b) =>
        b.cellCount - a.cellCount || b.investedKzt - a.investedKzt,
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * World standings for a category — aggregated across every country arena
 * rather than sold separately, so nobody pays twice for the same continent.
 */
export async function worldStandings(
  categoryId: string,
): Promise<ArenaStanding[]> {
  const rows = await prisma.cell.groupBy({
    by: ["ownerBrandId"],
    where: {
      state: { in: [...OCCUPIED_STATES] },
      ownerBrandId: { not: null },
      arena: {
        scope: { kind: "COUNTRY" },
        seasonCategory: { categoryId },
      },
    },
    _count: { _all: true },
    _sum: { investedKzt: true },
  });

  return rows
    .map((row) => ({
      brandId: row.ownerBrandId as string,
      cellCount: row._count._all,
      investedKzt: row._sum.investedKzt ?? 0,
    }))
    .sort(
      (a, b) => b.cellCount - a.cellCount || b.investedKzt - a.investedKzt,
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export type ResolvedArena = {
  arenaId: string;
  seasonCategoryId: string;
  categoryId: string;
  coreRadius: number;
  frontierRadius: number;
  scopeSlug: string;
  scopeNameRu: string;
  scopeNameKk: string;
};

/**
 * Find the playfield for a category in a scope, creating its grid on first
 * access so a newly opened city is never an empty page.
 */
export async function resolveArena(params: {
  categorySlug: string;
  scopeSlug?: string;
}): Promise<ResolvedArena | null> {
  const scopeSlug = params.scopeSlug ?? "kz";

  const [category, scope, activeSeason] = await Promise.all([
    prisma.category.findUnique({
      where: { slug: params.categorySlug },
      select: { id: true },
    }),
    prisma.scope.findUnique({
      where: { slug: scopeSlug },
      select: { id: true, slug: true, nameRu: true, nameKk: true, isOpen: true },
    }),
    prisma.season.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  if (!category || !scope || !activeSeason || !scope.isOpen) return null;

  const seasonCategory = await prisma.seasonCategory.findUnique({
    where: {
      seasonId_categoryId: {
        seasonId: activeSeason.id,
        categoryId: category.id,
      },
    },
    select: { id: true },
  });
  if (!seasonCategory) return null;

  const arenaId = await ensureArena(seasonCategory.id, scope.id);

  const arena = await prisma.arena.findUnique({
    where: { id: arenaId },
    select: { coreRadius: true, frontierRadius: true },
  });

  return {
    arenaId,
    seasonCategoryId: seasonCategory.id,
    categoryId: category.id,
    coreRadius: arena?.coreRadius ?? CORE_RADIUS_DEFAULT,
    frontierRadius: arena?.frontierRadius ?? FRONTIER_RADIUS_DEFAULT,
    scopeSlug: scope.slug,
    scopeNameRu: scope.nameRu,
    scopeNameKk: scope.nameKk,
  };
}

export { WORLD_SLUG };
