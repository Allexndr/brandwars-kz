import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";
import { collectSocialPosts } from "@/lib/social-queue";
import { isSocialAutoPublishEnabled } from "@/lib/social-publish-mode";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  leader_change: "Смена лидера",
  contest_opened: "Окно открылось",
  contest_resolved: "Итог окна",
  land_released: "Освободилась земля",
  digest: "Дайджест",
};

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status =
    request.nextUrl.searchParams.get("status") === "posted" ? "POSTED" : "QUEUED";

  const rows = await prisma.socialPost.findMany({
    where: { status },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: status === "QUEUED" ? 50 : 30,
  });

  const grouped = new Map<
    string,
    {
      dedupeKey: string;
      kind: string;
      kindLabel: string;
      text: string;
      linkUrl: string | null;
      priority: number;
      threadsPick: boolean;
      createdAt: string;
      postedAt: string | null;
      ids: string[];
      channels: string[];
    }
  >();

  for (const row of rows) {
    const existing = grouped.get(row.dedupeKey);
    if (existing) {
      existing.ids.push(row.id);
      if (!existing.channels.includes(row.channel)) {
        existing.channels.push(row.channel);
      }
      continue;
    }

    grouped.set(row.dedupeKey, {
      dedupeKey: row.dedupeKey,
      kind: row.kind,
      kindLabel: KIND_LABELS[row.kind] ?? row.kind,
      text: row.text,
      linkUrl: row.linkUrl,
      priority: row.priority,
      threadsPick: row.priority >= 80,
      createdAt: row.createdAt.toISOString(),
      postedAt: row.postedAt?.toISOString() ?? null,
      ids: [row.id],
      channels: [row.channel],
    });
  }

  return NextResponse.json({
    mode: isSocialAutoPublishEnabled() ? "auto" : "manual",
    posts: [...grouped.values()],
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "collect") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const collected = await collectSocialPosts();
  return NextResponse.json({ ok: true, collected });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    dedupeKey?: string;
    action?: string;
  };

  if (body.action !== "mark_posted" || !body.dedupeKey) {
    return NextResponse.json({ error: "dedupeKey required" }, { status: 400 });
  }

  const result = await prisma.socialPost.updateMany({
    where: { dedupeKey: body.dedupeKey, status: "QUEUED" },
    data: {
      status: "POSTED",
      postedAt: new Date(),
      providerPostId: "manual",
      error: null,
    },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
