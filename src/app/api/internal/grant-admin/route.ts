import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.FOUNDERS_SEED_SECRET?.trim();
  const received = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  return Boolean(expected && received && expected === received);
}

/**
 * Promote an existing user (or create stub) to ADMIN. Auth: FOUNDERS_SEED_SECRET.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    role?: "ADMIN" | "MODERATOR";
  };

  const email = body.email?.trim().toLowerCase();
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const role = body.role === "MODERATOR" ? "MODERATOR" : "ADMIN";

  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: {
      email,
      name: email.split("@")[0],
      role,
      profile: { create: { locale: "ru" } },
      wallet: { create: { balance: 0 } },
    },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, user });
}
