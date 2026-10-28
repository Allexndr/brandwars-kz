import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { worldStandings } from "@/lib/arena";
import { sellableLeaderSlots } from "@/lib/scopes";
import { syncCategoryCatalog } from "@/lib/category-sync";

export const dynamic = "force-dynamic";

/**
 * The scope tree and what it is worth.
 *
 * Every (category x open scope) pair has exactly one leader, so opening a city
 * multiplies both the sellable "#1" positions and the indexable pages. Closed
 * cities are reported too, with the brand count still needed to open them —
 * that gap is itself a reason for brands to recruit their city.
 */
export async function GET(request: NextRequest) {
  const categorySlug = request.nextUrl.searchParams.get("category");
  await syncCategoryCatalog();

  const [scopes, categoryCount] = await Promise.all([
    prisma.scope.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        kind: true,
        nameRu: true,
        nameKk: true,
        isOpen: true,
        openAtBrands: true,
        parent: { select: { slug: true } },
        _count: { select: { arenas: true } },
      },
    }),
    prisma.category.count({ where: { isActive: true } }),
  ]);

  const openScopes = scopes.filter((scope) => scope.isOpen);
  const localBrandCounts = Object.fromEntries(
    await Promise.all(
      scopes
        .filter((scope) => scope.kind === "CITY")
        .map(async (scope) => [
          scope.slug,
          await prisma.brandClaim.count({
            where: {
              status: "APPROVED",
              brandId: { not: null },
              metadata: { path: ["cityScopeSlug"], equals: scope.slug },
            },
          }),
        ]),
    ),
  ) as Record<string, number>;

  // World standings are aggregated across country arenas rather than sold
  // separately, so a brand is never charged twice for the same continent.
  let world: Awaited<ReturnType<typeof worldStandings>> = [];
  let worldBrands: Record<string, { slug: string; name: string }> = {};

  if (categorySlug) {
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true },
    });

    if (category) {
      world = await worldStandings(category.id);
      const brands = await prisma.brand.findMany({
        where: { id: { in: world.map((row) => row.brandId) } },
        select: { id: true, slug: true, name: true },
      });
      worldBrands = Object.fromEntries(
        brands.map((brand) => [brand.id, { slug: brand.slug, name: brand.name }]),
      );
    }
  }

  return NextResponse.json({
    scopes: scopes.map((scope) => ({
      slug: scope.slug,
      kind: scope.kind,
      nameRu: scope.nameRu,
      nameKk: scope.nameKk,
      parentSlug: scope.parent?.slug ?? null,
      isOpen: scope.isOpen,
      openAtBrands: scope.openAtBrands,
      localBrandCount: localBrandCounts[scope.slug] ?? null,
      brandsNeeded:
        scope.kind === "CITY"
          ? Math.max(0, scope.openAtBrands - (localBrandCounts[scope.slug] ?? 0))
          : 0,
      arenaCount: scope._count.arenas,
    })),
    economics: {
      categoryCount,
      openScopeCount: openScopes.length,
      sellableLeaderSlots: sellableLeaderSlots(categoryCount, openScopes.length),
    },
    ...(categorySlug
      ? {
          worldStandings: world.slice(0, 20).map((row) => ({
            rank: row.rank,
            cellCount: row.cellCount,
            investedKzt: row.investedKzt,
            brand: worldBrands[row.brandId] ?? null,
          })),
        }
      : {}),
  });
}
