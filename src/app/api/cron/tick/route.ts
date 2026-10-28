import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  expandFrontierIfNeeded,
  openReadyCityScopes,
  runDecayTick,
} from "@/lib/arena";
import { resolveDueContests } from "@/lib/contest";
import { recalculateCategory } from "@/lib/territory";
import { sendMonthlyReports } from "@/lib/monthly-report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The heartbeat that makes the world move on its own.
 *
 *   1. close siege windows whose time is up;
 *   2. fade cells nobody has maintained, release the ones past grace;
 *   3. grow frontiers that filled up;
 *   4. open cities that reached enough brands;
 *   5. recompute standings for whatever changed.
 *
 * Without this, the map freezes: every good cell stays with whoever paid once,
 * and there is no reason for anyone to pay again.
 */
async function tick() {
  const now = new Date();

  const contests = await resolveDueContests(now);
  const decay = await runDecayTick(now);
  const openedCities = await openReadyCityScopes();

  const arenas = await prisma.arena.findMany({ select: { id: true } });
  let expanded = 0;
  for (const arena of arenas) {
    if (await expandFrontierIfNeeded(arena.id)) expanded++;
  }

  // Only recompute categories that could have changed.
  let recalculated = 0;
  if (contests.resolved > 0 || decay.released > 0 || decay.startedFading > 0) {
    const seasonCategories = await prisma.seasonCategory.findMany({
      where: { season: { status: "ACTIVE" } },
      select: { id: true },
    });
    for (const seasonCategory of seasonCategories) {
      await recalculateCategory(seasonCategory.id);
      recalculated++;
    }
  }

  // Monthly performance email, gated to the 1st so a daily tick yields a
  // monthly cadence without spending another cron slot.
  let monthlyReports: Awaited<ReturnType<typeof sendMonthlyReports>> | null = null;
  if (now.getUTCDate() === 1) {
    monthlyReports = await sendMonthlyReports(now).catch((error) => {
      console.error("[monthly-report]", error);
      return null;
    });
  }

  return {
    ranAt: now.toISOString(),
    monthlyReports,
    contestsResolved: contests.resolved,
    cellsStartedFading: decay.startedFading,
    cellsReleased: decay.released,
    frontiersExpanded: expanded,
    citiesOpened: openedCities,
    categoriesRecalculated: recalculated,
  };
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await tick());
}

export async function POST(request: NextRequest) {
  return GET(request);
}
