import "server-only";

import { prisma } from "@/lib/prisma";
import {
  CATEGORY_CATALOG,
  ENTRY_PRICE_KZT,
  TERRITORY_CELL_PRICE_KZT,
} from "@/lib/category-catalog";
import { ensureArenasForActiveSeason, ensureScopes } from "@/lib/arena";

let lastSync = 0;

/** A season runs 30 days; the first one starts the moment the platform does. */
const SEASON_DAYS = 30;

/**
 * Guarantee there is a season to sell into.
 *
 * Without an ACTIVE season every purchase path answers "нет активного сезона",
 * which is indistinguishable from the platform being broken — and it is exactly
 * the state a fresh production database starts in. Seasons are containers, not
 * data, so creating one is safe to do automatically; rolling to the next one
 * stays a deliberate act.
 */
async function ensureActiveSeason(): Promise<{ id: string } | null> {
  const active = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (active) return active;

  const now = new Date();
  const slug = `s${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  // Upsert on the slug so two concurrent cold requests cannot create two.
  const created = await prisma.season.upsert({
    where: { slug },
    update: { status: "ACTIVE" },
    create: {
      slug,
      nameRu: `Сезон ${now.getUTCFullYear()}`,
      nameKk: `Маусым ${now.getUTCFullYear()}`,
      status: "ACTIVE",
      startsAt: now,
      endsAt: new Date(now.getTime() + SEASON_DAYS * 86_400_000),
    },
    select: { id: true },
  });

  return created;
}

/**
 * Keeps the MVP catalogue deployable without a separate data migration.
 * The operation is throttled and all writes are idempotent upserts.
 */
export async function syncCategoryCatalog(): Promise<void> {
  if (Date.now() - lastSync < 5 * 60_000) return;

  const activeSeason = await ensureActiveSeason();

  const categories = await Promise.all(
    CATEGORY_CATALOG.map((definition, sortOrder) =>
      prisma.category.upsert({
        where: { slug: definition.slug },
        update: {
          nameRu: definition.nameRu,
          nameKk: definition.nameKk,
          continentRu: definition.continentRu,
          continentKk: definition.continentKk,
          color: definition.color,
          sortOrder,
          isActive: true,
        },
        create: {
          slug: definition.slug,
          nameRu: definition.nameRu,
          nameKk: definition.nameKk,
          continentRu: definition.continentRu,
          continentKk: definition.continentKk,
          color: definition.color,
          sortOrder,
          isActive: true,
        },
      }),
    ),
  );

  if (activeSeason) {
    await Promise.all(
      categories.map((category) =>
        prisma.seasonCategory.upsert({
        where: {
          seasonId_categoryId: {
            seasonId: activeSeason.id,
            categoryId: category.id,
          },
        },
        update: {
          entryMinimumKzt: ENTRY_PRICE_KZT,
          priceCoefficient: TERRITORY_CELL_PRICE_KZT,
          status: "ACTIVE",
        },
        create: {
          seasonId: activeSeason.id,
          categoryId: category.id,
          entryMinimumKzt: ENTRY_PRICE_KZT,
          priceCoefficient: TERRITORY_CELL_PRICE_KZT,
          status: "ACTIVE",
        },
        }),
      ),
    );
  }

  // Scope tree first, then a cell grid for every (category x open scope) pair —
  // both idempotent, so this stays a no-op once the world exists.
  await ensureScopes();
  await ensureArenasForActiveSeason();

  lastSync = Date.now();
}
