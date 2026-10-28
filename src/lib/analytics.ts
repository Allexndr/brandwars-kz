import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Click and presence tracking.
 *
 * Outbound clicks are the number that turns a paid position from a novelty
 * into an ad buy with a payback story — it is the only honest answer to "what
 * did I get for my money", and therefore the thing that drives a second
 * payment. Presence counters are pure social proof in the header.
 */

/** A click from the same visitor to the same brand counts once per window. */
export const CLICK_DEDUPE_MINUTES = 30;
/** A visitor seen within this window counts as online. */
export const ONLINE_WINDOW_MINUTES = 5;
/** A returning visitor after this long counts as a new visit. */
export const VISIT_WINDOW_MINUTES = 30;

const SALT = process.env.NEXTAUTH_SECRET ?? "brandwars-analytics";

/**
 * Hash before storing. We need to tell visitors apart to deduplicate, not to
 * know who they are — storing raw IPs would be personal data for no benefit.
 */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(`${SALT}:${value}`).digest("hex").slice(0, 32);
}

export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export type RecordClickResult = {
  counted: boolean;
  clickCount: number;
};

/**
 * Record an outbound click, ignoring repeats from the same visitor inside the
 * dedupe window so a brand cannot inflate its own number by refreshing.
 */
export async function recordBrandClick(params: {
  brandId: string;
  ipHash: string | null;
  referer: string | null;
  userAgent: string | null;
}): Promise<RecordClickResult> {
  const since = new Date(Date.now() - CLICK_DEDUPE_MINUTES * 60_000);

  if (params.ipHash) {
    const recent = await prisma.brandClick.findFirst({
      where: {
        brandId: params.brandId,
        ipHash: params.ipHash,
        createdAt: { gte: since },
      },
      select: { id: true },
    });

    if (recent) {
      const brand = await prisma.brand.findUnique({
        where: { id: params.brandId },
        select: { clickCount: true },
      });
      return { counted: false, clickCount: brand?.clickCount ?? 0 };
    }
  }

  const [, brand] = await prisma.$transaction([
    prisma.brandClick.create({
      data: {
        brandId: params.brandId,
        ipHash: params.ipHash,
        referer: params.referer?.slice(0, 500) ?? null,
        userAgent: params.userAgent?.slice(0, 300) ?? null,
      },
    }),
    prisma.brand.update({
      where: { id: params.brandId },
      data: { clickCount: { increment: 1 } },
      select: { clickCount: true },
    }),
  ]);

  return { counted: true, clickCount: brand.clickCount };
}

/** Clicks in the last N hours, for "today" style reporting. */
export async function clickCountSince(
  brandIds: string[],
  since: Date,
): Promise<Map<string, number>> {
  if (brandIds.length === 0) return new Map();

  const rows = await prisma.brandClick.groupBy({
    by: ["brandId"],
    where: { brandId: { in: brandIds }, createdAt: { gte: since } },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.brandId, row._count._all]));
}

export type PresenceResult = {
  online: number;
  totalVisits: number;
};

/**
 * Touch a visitor. A gap longer than the visit window counts as a fresh visit
 * and bumps the lifetime counter.
 */
export async function recordVisit(sessionHash: string): Promise<void> {
  const now = new Date();
  const visitCutoff = new Date(now.getTime() - VISIT_WINDOW_MINUTES * 60_000);

  const existing = await prisma.visitor.findUnique({
    where: { sessionHash },
    select: { lastSeenAt: true },
  });

  const isNewVisit = !existing || existing.lastSeenAt < visitCutoff;

  await prisma.visitor.upsert({
    where: { sessionHash },
    update: {
      lastSeenAt: now,
      ...(isNewVisit ? { hits: { increment: 1 } } : {}),
    },
    create: { sessionHash, firstSeenAt: now, lastSeenAt: now, hits: 1 },
  });

  if (isNewVisit) {
    await prisma.siteStat.upsert({
      where: { id: "global" },
      update: { totalVisits: { increment: 1 } },
      create: { id: "global", totalVisits: 1 },
    });
  }
}

export async function getPresence(): Promise<PresenceResult> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60_000);

  const [online, stat] = await Promise.all([
    prisma.visitor.count({ where: { lastSeenAt: { gte: since } } }),
    prisma.siteStat.findUnique({
      where: { id: "global" },
      select: { totalVisits: true },
    }),
  ]);

  return { online, totalVisits: stat?.totalVisits ?? 0 };
}
