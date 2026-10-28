import "server-only";

import { prisma } from "@/lib/prisma";
import { publishTextPost, threadsConfig } from "@/lib/threads";
import {
  MIN_INTERVAL_MS,
  sendChannelMessage,
  telegramConfig,
} from "@/lib/telegram";
import type { SocialChannel } from "@prisma/client";
import {
  almatyDay,
  contestOpenedDraft,
  contestResolvedDraft,
  digestDraft,
  landReleasedDraft,
  leaderChangeDraft,
  plural,
  CELLS,
  type BrandRef,
  type PostDraft,
} from "@/lib/social-copy";

/**
 * Collects stories from real events, queues them, and drains the queue inside
 * the channel's daily budget.
 *
 * The queue exists because the cap is 250 posts per 24 hours: a busy day
 * produces hundreds of cell claims, and firing a post per event would burn the
 * budget by lunchtime and lose exactly the stories worth telling. Significant
 * events go out immediately; the small stuff is rolled into a digest.
 */

/**
 * Per-channel daily budgets.
 *
 * Threads' hard API cap is 250/day, but that is not the real constraint: its
 * 2026 ranking treats frequency as a negative signal, and more than ~5 posts a
 * day makes an account compete with itself. So Threads gets the best few
 * stories, while the Telegram channel — opted-in subscribers, no comparable
 * cap, and the far larger audience in Kazakhstan — carries the full firehose.
 */
const CHANNEL_BUDGET: Record<SocialChannel, number> = {
  THREADS: 3,
  TELEGRAM: 40,
};

/** Only these story kinds are worth spending a Threads slot on. */
const THREADS_MIN_PRIORITY = 80;

function appUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://brandwars.kz";
}

/**
 * A brand may be named in a post only while it is a paying participant.
 * Anything else reintroduces the discreditation exposure the opt-in design
 * removed, so this is resolved from the database rather than trusted.
 */
async function brandRefs(brandIds: string[]): Promise<Map<string, BrandRef>> {
  if (brandIds.length === 0) return new Map();

  const brands = await prisma.brand.findMany({
    where: { id: { in: brandIds } },
    select: {
      id: true,
      name: true,
      isActive: true,
      verificationStatus: true,
      territories: { select: { cellCount: true }, take: 1 },
      transactions: {
        where: { status: "COMPLETED" },
        select: { id: true },
        take: 1,
      },
    },
  });

  return new Map(
    brands.map((brand) => [
      brand.id,
      {
        id: brand.id,
        name: brand.name,
        isParticipant:
          brand.isActive &&
          brand.verificationStatus !== "REJECTED" &&
          brand.transactions.length > 0,
      },
    ]),
  );
}

/**
 * Fan one story out to every channel that should carry it.
 *
 * Telegram gets everything; Threads only the high-priority stories, because a
 * slot there is scarce by algorithm rather than by quota.
 */
async function enqueue(draft: PostDraft, arenaId?: string): Promise<number> {
  const channels: SocialChannel[] = ["TELEGRAM"];
  if (draft.priority >= THREADS_MIN_PRIORITY) channels.push("THREADS");

  let created = 0;
  for (const channel of channels) {
    try {
      await prisma.socialPost.create({
        data: {
          channel,
          kind: draft.kind,
          text: draft.text,
          linkUrl: `${appUrl()}${draft.linkPath}`,
          priority: draft.priority,
          dedupeKey: draft.dedupeKey,
          brandIds: draft.brandIds,
          arenaId: arenaId ?? null,
          status: "QUEUED",
        },
      });
      created++;
    } catch {
      // Unique (channel, dedupeKey) violation: already queued or posted there.
    }
  }
  return created;
}

export type CollectResult = {
  queued: number;
  skippedNonParticipant: number;
};

/**
 * Turn recent events into queued posts.
 *
 * Idempotent: every draft carries a dedupe key derived from the story, so
 * running this repeatedly never double-posts.
 */
export async function collectSocialPosts(
  now = new Date(),
): Promise<CollectResult> {
  const day = almatyDay(now);
  const since = new Date(now.getTime() - 26 * 3_600_000);
  let queued = 0;
  let skipped = 0;

  // ---- resolved contests: the strongest story, it has an outcome ----
  const resolved = await prisma.contest.findMany({
    where: { status: "RESOLVED", resolvedAt: { gte: since } },
    select: {
      id: true,
      challengerBrandId: true,
      defenderBrandId: true,
      winnerBrandId: true,
      challengerKzt: true,
      defenderKzt: true,
      arenaId: true,
      arena: {
        select: {
          seasonCategory: {
            select: { category: { select: { slug: true, continentRu: true } } },
          },
        },
      },
    },
    take: 40,
  });

  for (const contest of resolved) {
    if (!contest.defenderBrandId || !contest.winnerBrandId) continue;
    const refs = await brandRefs([
      contest.challengerBrandId,
      contest.defenderBrandId,
    ]);
    const winner = refs.get(contest.winnerBrandId);
    const loserId =
      contest.winnerBrandId === contest.challengerBrandId
        ? contest.defenderBrandId
        : contest.challengerBrandId;
    const loser = refs.get(loserId);
    if (!winner || !loser) continue;
    if (!winner.isParticipant || !loser.isParticipant) {
      skipped++;
      continue;
    }

    const category = contest.arena.seasonCategory.category;
    const draft = contestResolvedDraft({
      contestId: contest.id,
      continent: category.continentRu,
      categorySlug: category.slug,
      winner,
      loser,
      challengerWon: contest.winnerBrandId === contest.challengerBrandId,
      challengerKzt: contest.challengerKzt,
      defenderKzt: contest.defenderKzt,
    });

    if (draft) queued += await enqueue(draft, contest.arenaId);
  }

  // ---- open contests worth announcing ----
  const open = await prisma.contest.findMany({
    where: { status: "OPEN", opensAt: { gte: since } },
    select: {
      id: true,
      challengerBrandId: true,
      defenderBrandId: true,
      challengerKzt: true,
      defenderKzt: true,
      closesAt: true,
      arenaId: true,
      arena: {
        select: {
          seasonCategory: {
            select: { category: { select: { slug: true, continentRu: true } } },
          },
        },
      },
    },
    take: 40,
  });

  for (const contest of open) {
    if (!contest.defenderBrandId) continue;
    const refs = await brandRefs([
      contest.challengerBrandId,
      contest.defenderBrandId,
    ]);
    const challenger = refs.get(contest.challengerBrandId);
    const defender = refs.get(contest.defenderBrandId);
    if (!challenger || !defender) continue;
    if (!challenger.isParticipant || !defender.isParticipant) {
      skipped++;
      continue;
    }

    const hoursLeft = Math.max(
      1,
      Math.round((contest.closesAt.getTime() - now.getTime()) / 3_600_000),
    );
    const category = contest.arena.seasonCategory.category;

    const draft = contestOpenedDraft({
      contestId: contest.id,
      continent: category.continentRu,
      categorySlug: category.slug,
      challenger,
      defender,
      challengerKzt: contest.challengerKzt,
      defenderKzt: contest.defenderKzt,
      hoursLeft,
    });

    if (draft) queued += await enqueue(draft, contest.arenaId);
  }

  // ---- leader of each category ----
  const leaders = await prisma.territory.findMany({
    where: { rank: 1 },
    select: {
      brandId: true,
      cellCount: true,
      battlePower: true,
      seasonCategory: {
        select: {
          id: true,
          category: { select: { slug: true, continentRu: true } },
        },
      },
    },
    take: 40,
  });

  for (const leader of leaders) {
    const refs = await brandRefs([leader.brandId]);
    const brand = refs.get(leader.brandId);
    if (!brand) continue;
    if (!brand.isParticipant) {
      skipped++;
      continue;
    }

    const runnerUp = await prisma.territory.findFirst({
      where: { seasonCategoryId: leader.seasonCategory.id, rank: 2 },
      select: { brandId: true, battlePower: true },
    });
    const runnerUpRef = runnerUp
      ? (await brandRefs([runnerUp.brandId])).get(runnerUp.brandId) ?? null
      : null;

    const totalCells = await prisma.cell.count({
      where: {
        arena: { seasonCategoryId: leader.seasonCategory.id },
        layer: { not: "CAPITAL" },
      },
    });

    const draft = leaderChangeDraft({
      continent: leader.seasonCategory.category.continentRu,
      categorySlug: leader.seasonCategory.category.slug,
      newLeader: brand,
      previousLeader: runnerUpRef?.isParticipant ? runnerUpRef : null,
      newAmountKzt: Math.round(leader.battlePower),
      previousAmountKzt: Math.round(runnerUp?.battlePower ?? 0),
      cellCount: leader.cellCount,
      totalCells,
      takePlaceKzt: Math.ceil((leader.battlePower + 1) / 500) * 500,
      seasonDay: day,
    });

    if (draft) queued += await enqueue(draft);
  }

  // ---- freed land: the best selling post, and it names nobody ----
  const releasedByArena = await prisma.cellEvent.groupBy({
    by: ["arenaId"],
    where: { type: "RELEASED", createdAt: { gte: since } },
    _count: { _all: true },
  });

  for (const row of releasedByArena) {
    const arena = await prisma.arena.findUnique({
      where: { id: row.arenaId },
      select: {
        id: true,
        coreRadius: true,
        seasonCategory: {
          select: { category: { select: { slug: true, continentRu: true } } },
        },
      },
    });
    if (!arena) continue;

    const brandsInArena = await prisma.cell.groupBy({
      by: ["ownerBrandId"],
      where: {
        arenaId: arena.id,
        ownerBrandId: { not: null },
        state: { in: ["HELD", "CONTESTED", "FADING"] },
      },
    });

    const capitalCell = await prisma.cell.findFirst({
      where: { arenaId: arena.id, ring: 1 },
      select: { priceKzt: true },
    });

    const draft = landReleasedDraft({
      continent: arena.seasonCategory.category.continentRu,
      categorySlug: arena.seasonCategory.category.slug,
      releasedCells: row._count._all,
      brandsInArena: brandsInArena.length,
      capitalCellKzt: capitalCell?.priceKzt ?? 1500,
      day,
    });

    if (draft) queued += await enqueue(draft, arena.id);
  }

  // ---- digest: everything too small to post on its own ----
  const claimsByArena = await prisma.cellEvent.groupBy({
    by: ["arenaId"],
    where: { type: "CLAIMED", createdAt: { gte: since } },
    _count: { _all: true },
  });

  for (const row of claimsByArena) {
    if (row._count._all < 2) continue;

    const arena = await prisma.arena.findUnique({
      where: { id: row.arenaId },
      select: {
        id: true,
        seasonCategoryId: true,
        seasonCategory: {
          select: { category: { select: { slug: true, continentRu: true } } },
        },
      },
    });
    if (!arena) continue;

    const events = await prisma.cellEvent.groupBy({
      by: ["brandId"],
      where: {
        arenaId: arena.id,
        type: "CLAIMED",
        createdAt: { gte: since },
        brandId: { not: null },
      },
      _count: { _all: true },
      _sum: { amountKzt: true },
    });

    const refs = await brandRefs(
      events.map((e) => e.brandId).filter((id): id is string => Boolean(id)),
    );

    const lines = events
      .map((event) => {
        const brand = event.brandId ? refs.get(event.brandId) : undefined;
        if (!brand) return null;
        const n = event._count._all;
        return { brand, what: `+${n} ${plural(n, CELLS)}` };
      })
      .filter((line): line is { brand: BrandRef; what: string } => line !== null);

    const clicks = await prisma.brandClick.count({
      where: {
        brandId: { in: lines.map((l) => l.brand.id) },
        createdAt: { gte: since },
      },
    });

    const draft = digestDraft({
      continent: arena.seasonCategory.category.continentRu,
      categorySlug: arena.seasonCategory.category.slug,
      lines,
      totalKzt: events.reduce((sum, e) => sum + (e._sum.amountKzt ?? 0), 0),
      clicks,
      day,
      slot: now.getUTCHours() < 12 ? "am" : "pm",
    });

    if (draft) queued += await enqueue(draft, arena.id);
  }

  return { queued, skippedNonParticipant: skipped };
}

export type ChannelDrain = {
  channel: SocialChannel;
  posted: number;
  failed: number;
  remaining: number;
  budgetLeft: number;
  configured: boolean;
};

export type DrainResult = {
  channels: ChannelDrain[];
  posted: number;
};

async function publishOne(
  channel: SocialChannel,
  item: { text: string; linkUrl: string | null },
): Promise<
  | { ok: true; providerId: string }
  | { ok: false; error: string; retryable: boolean; waitMs?: number }
> {
  if (channel === "TELEGRAM") {
    const config = telegramConfig();
    if (!config) return { ok: false, error: "not configured", retryable: true };
    const result = await sendChannelMessage({
      config,
      text: item.text,
      linkUrl: item.linkUrl,
    });
    return result.ok
      ? { ok: true, providerId: result.messageId }
      : {
          ok: false,
          error: result.error,
          retryable: result.retryable,
          waitMs: result.retryAfterMs,
        };
  }

  const config = threadsConfig();
  if (!config) return { ok: false, error: "not configured", retryable: true };
  const result = await publishTextPost({
    config,
    text: item.text,
    linkUrl: item.linkUrl,
    // Containers are published on the next tick rather than holding the
    // function open for Meta's recommended settle time.
    settleMs: 2_000,
  });
  return result.ok
    ? { ok: true, providerId: result.postId }
    : { ok: false, error: result.error, retryable: result.retryable };
}

/**
 * Publish queued posts per channel, highest priority first, never exceeding
 * that channel's daily budget.
 *
 * A channel with no credentials configured is skipped and its posts stay
 * queued, so switching it on later publishes the backlog instead of losing it.
 */
export async function drainSocialQueue(
  options: { maxPerChannel?: number; now?: Date } = {},
): Promise<DrainResult> {
  const now = options.now ?? new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const configured: Record<SocialChannel, boolean> = {
    THREADS: Boolean(threadsConfig()),
    TELEGRAM: Boolean(telegramConfig()),
  };

  const channels: ChannelDrain[] = [];
  let totalPosted = 0;

  for (const channel of ["TELEGRAM", "THREADS"] as SocialChannel[]) {
    const [postedLast24h, remaining] = await Promise.all([
      prisma.socialPost.count({
        where: { channel, status: "POSTED", postedAt: { gte: dayAgo } },
      }),
      prisma.socialPost.count({ where: { channel, status: "QUEUED" } }),
    ]);

    const budgetLeft = Math.max(0, CHANNEL_BUDGET[channel] - postedLast24h);

    if (!configured[channel] || budgetLeft === 0) {
      channels.push({
        channel,
        posted: 0,
        failed: 0,
        remaining,
        budgetLeft,
        configured: configured[channel],
      });
      continue;
    }

    const take = Math.min(options.maxPerChannel ?? budgetLeft, budgetLeft);
    const batch = await prisma.socialPost.findMany({
      where: { channel, status: "QUEUED" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take,
    });

    let posted = 0;
    let failed = 0;

    for (const item of batch) {
      // Re-check participation at publish time: a brand may have been
      // suspended between queueing and posting.
      if (item.brandIds.length > 0) {
        const refs = await brandRefs(item.brandIds);
        if (!item.brandIds.every((id) => refs.get(id)?.isParticipant)) {
          await prisma.socialPost.update({
            where: { id: item.id },
            data: { status: "SKIPPED", error: "brand no longer a participant" },
          });
          continue;
        }
      }

      const result = await publishOne(channel, {
        text: item.text,
        linkUrl: item.linkUrl,
      });

      if (result.ok) {
        await prisma.socialPost.update({
          where: { id: item.id },
          data: {
            status: "POSTED",
            providerPostId: result.providerId,
            postedAt: new Date(),
            error: null,
          },
        });
        posted++;
        totalPosted++;
        if (channel === "TELEGRAM" && posted < batch.length) {
          await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS));
        }
      } else {
        await prisma.socialPost.update({
          where: { id: item.id },
          data: {
            status: result.retryable ? "QUEUED" : "FAILED",
            error: result.error.slice(0, 500),
          },
        });
        failed++;
        // Stop this channel rather than burning the queue on the same error.
        break;
      }
    }

    channels.push({
      channel,
      posted,
      failed,
      remaining: await prisma.socialPost.count({
        where: { channel, status: "QUEUED" },
      }),
      budgetLeft: budgetLeft - posted,
      configured: true,
    });
  }

  return { channels, posted: totalPosted };
}
