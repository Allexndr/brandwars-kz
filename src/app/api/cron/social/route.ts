import { NextRequest, NextResponse } from "next/server";
import { collectSocialPosts, drainSocialQueue } from "@/lib/social-queue";
import { isSocialAutoPublishEnabled } from "@/lib/social-publish-mode";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Collect stories, then publish a few of them.
 *
 * Runs often and posts little: the channel allows 250 posts per 24h, and the
 * queue is ordered by priority, so a leader change always beats a digest when
 * the budget is tight.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collected = await collectSocialPosts();
  const drained = isSocialAutoPublishEnabled()
    ? await drainSocialQueue()
    : { channels: [], posted: 0, mode: "manual" as const };

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    collected,
    drained,
    publishMode: isSocialAutoPublishEnabled() ? "auto" : "manual",
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
