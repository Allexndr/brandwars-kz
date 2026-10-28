import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveArena } from "@/lib/arena";
import { fadingExpiresAt, minChallengeKzt, upkeepDueAt } from "@/lib/land";
import { syncCategoryCatalog } from "@/lib/category-sync";
import { resolveDueContests } from "@/lib/contest";

export const dynamic = "force-dynamic";

/**
 * The full grid for one arena: every cell, who holds it, what it costs and
 * whether a siege window is running on it.
 *
 * This is what lets the claim flow show a brand the exact plot it is buying
 * before payment, instead of an abstract "you will appear in the category".
 */
export async function GET(request: NextRequest) {
  const categorySlug = request.nextUrl.searchParams.get("category");
  const scopeSlug = request.nextUrl.searchParams.get("scope") ?? "kz";

  if (!categorySlug) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  await syncCategoryCatalog();
  await resolveDueContests();

  const arena = await resolveArena({ categorySlug, scopeSlug });
  if (!arena) {
    return NextResponse.json(
      { error: "Arena not found or scope is not open yet" },
      { status: 404 },
    );
  }

  const [cells, contests] = await Promise.all([
    prisma.cell.findMany({
      where: { arenaId: arena.arenaId },
      orderBy: [{ ring: "asc" }, { q: "asc" }, { r: "asc" }],
      select: {
        id: true,
        q: true,
        r: true,
        ring: true,
        layer: true,
        state: true,
        priceKzt: true,
        investedKzt: true,
        lastUpkeepAt: true,
        fadingSince: true,
        ownerBrand: {
          select: { id: true, slug: true, name: true, logoUrl: true },
        },
      },
    }),
    prisma.contest.findMany({
      where: { arenaId: arena.arenaId, status: "OPEN" },
      select: {
        id: true,
        cellId: true,
        closesAt: true,
        challengerKzt: true,
        defenderKzt: true,
        challengerBrand: { select: { slug: true, name: true } },
        defenderBrand: { select: { slug: true, name: true } },
      },
    }),
  ]);

  const contestByCell = new Map(contests.map((c) => [c.cellId, c]));

  const claimable = cells.filter((cell) => cell.layer !== "CAPITAL");
  const occupied = claimable.filter((cell) => cell.state !== "NEUTRAL");

  return NextResponse.json({
    arena: {
      id: arena.arenaId,
      categorySlug,
      scopeSlug: arena.scopeSlug,
      scopeNameRu: arena.scopeNameRu,
      scopeNameKk: arena.scopeNameKk,
      coreRadius: arena.coreRadius,
      frontierRadius: arena.frontierRadius,
      claimableCells: claimable.length,
      occupiedCells: occupied.length,
      occupancy: claimable.length > 0 ? occupied.length / claimable.length : 0,
    },
    cells: cells.map((cell) => {
      const contest = contestByCell.get(cell.id);
      return {
        id: cell.id,
        q: cell.q,
        r: cell.r,
        ring: cell.ring,
        layer: cell.layer,
        state: cell.state,
        priceKzt: cell.priceKzt,
        investedKzt: cell.investedKzt,
        upkeepDueAt: cell.lastUpkeepAt ? upkeepDueAt(cell.lastUpkeepAt) : null,
        fadingSince: cell.fadingSince,
        fadingExpiresAt: cell.fadingSince ? fadingExpiresAt(cell.fadingSince) : null,
        challengeFromKzt:
          cell.state === "NEUTRAL"
            ? cell.priceKzt
            : minChallengeKzt(cell.priceKzt, cell.investedKzt),
        owner: cell.ownerBrand
          ? {
              slug: cell.ownerBrand.slug,
              name: cell.ownerBrand.name,
              logoUrl: cell.ownerBrand.logoUrl,
            }
          : null,
        contest: contest
          ? {
              id: contest.id,
              closesAt: contest.closesAt,
              challengerKzt: contest.challengerKzt,
              defenderKzt: contest.defenderKzt,
              challenger: contest.challengerBrand.name,
              defender: contest.defenderBrand?.name ?? null,
            }
          : null,
      };
    }),
  });
}
