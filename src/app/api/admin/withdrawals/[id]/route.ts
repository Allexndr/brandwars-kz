import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/session";
import { reviewWithdrawal } from "@/lib/brand-earnings";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["approve", "reject", "paid"]),
  adminNote: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
  }

  const result = await reviewWithdrawal({
    withdrawalId: id,
    reviewerId: session.user.id,
    action: parsed.data.action,
    adminNote: parsed.data.adminNote,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
