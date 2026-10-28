import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getPresence, hashIdentifier, recordVisit } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const COOKIE = "bw_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Live header counters, and the heartbeat that produces them.
 *
 * The visitor id is a random value in a first-party cookie, stored only as a
 * hash — enough to tell sessions apart for counting, useless for identifying
 * anyone.
 */
export async function GET(request: NextRequest) {
  let visitorId = request.cookies.get(COOKIE)?.value;
  const isNewCookie = !visitorId;
  if (!visitorId) visitorId = randomUUID();

  try {
    await recordVisit(hashIdentifier(visitorId));
  } catch (error) {
    console.error("[presence]", error);
  }

  const [presence, brandCount, contestCount] = await Promise.all([
    getPresence(),
    prisma.brand.count({ where: { isActive: true } }),
    prisma.contest.count({ where: { status: "OPEN" } }),
  ]);

  const response = NextResponse.json({
    online: presence.online,
    totalVisits: presence.totalVisits,
    brands: brandCount,
    openContests: contestCount,
  });

  if (isNewCookie) {
    response.cookies.set(COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}
