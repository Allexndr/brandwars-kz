import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkoutProviderSchema } from "@/lib/payments/methods";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveArena } from "@/lib/arena";
import { purchaseLand } from "@/lib/land-purchase";
import { assertBrandAccess } from "@/lib/brand-access";

export const dynamic = "force-dynamic";

const schema = z.object({
  brandId: z.string(),
  category: z.string(),
  scope: z.string().default("kz"),
  q: z.number().int(),
  r: z.number().int(),
  /** Optional over-payment: buying above list price banks value into the cell. */
  amountKzt: z.number().int().min(500).multipleOf(500).optional(),
  provider: checkoutProviderSchema.default("prodamus"),
  phone: z.string().min(10).max(30).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const access = await assertBrandAccess(session.user.id, parsed.data.brandId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const arena = await resolveArena({
    categorySlug: parsed.data.category,
    scopeSlug: parsed.data.scope,
  });
  if (!arena) {
    return NextResponse.json(
      { error: "Arena not found or scope is not open yet" },
      { status: 404 },
    );
  }
  if (access.primaryCategoryId !== arena.categoryId) {
    return NextResponse.json(
      { error: "Бренд может занимать клетки только в своей категории" },
      { status: 403 },
    );
  }

  const cell = await prisma.cell.findUnique({
    where: {
      arenaId_q_r: {
        arenaId: arena.arenaId,
        q: parsed.data.q,
        r: parsed.data.r,
      },
    },
    select: { id: true, state: true, layer: true, priceKzt: true },
  });

  if (!cell) {
    return NextResponse.json({ error: "Cell not found" }, { status: 404 });
  }
  if (cell.layer === "CAPITAL") {
    return NextResponse.json(
      { error: "Столица не продаётся" },
      { status: 409 },
    );
  }
  if (cell.state !== "NEUTRAL") {
    return NextResponse.json(
      { error: "Клетка занята — откройте окно противостояния", cellId: cell.id },
      { status: 409 },
    );
  }

  const amountKzt = Math.max(parsed.data.amountKzt ?? cell.priceKzt, cell.priceKzt);

  const outcome = await purchaseLand({
    intent: {
      kind: "cell_claim",
      arenaId: arena.arenaId,
      q: parsed.data.q,
      r: parsed.data.r,
      brandId: parsed.data.brandId,
    },
    userId: session.user.id,
    amountKzt,
    seasonCategoryId: arena.seasonCategoryId,
    paymentProvider: parsed.data.provider,
    phone: parsed.data.phone,
  });

  if (outcome.status === "error") {
    return NextResponse.json({ error: outcome.reason }, { status: 409 });
  }

  return NextResponse.json(outcome, {
    status: outcome.status === "applied" ? 201 : 202,
  });
}
