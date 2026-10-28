import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkoutProviderSchema } from "@/lib/payments/methods";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertBrandAccess } from "@/lib/brand-access";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";
import { purchaseLand } from "@/lib/land-purchase";

export const dynamic = "force-dynamic";

const schema = z.object({
  brandId: z.string(),
  amountKzt: z
    .number()
    .int()
    .min(TERRITORY_CELL_PRICE_KZT)
    .multipleOf(TERRITORY_CELL_PRICE_KZT),
  provider: checkoutProviderSchema.default("prodamus"),
  phone: z.string().min(10).max(30).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Минимальная поддержка клетки - 500 ₸, сумма должна быть кратна 500 ₸",
      },
      { status: 400 },
    );
  }

  const access = await assertBrandAccess(session.user.id, parsed.data.brandId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const cell = await prisma.cell.findUnique({
    where: { id },
    select: {
      ownerBrandId: true,
      state: true,
      arena: {
        select: {
          seasonCategoryId: true,
          seasonCategory: { select: { categoryId: true } },
        },
      },
    },
  });

  if (!cell) {
    return NextResponse.json({ error: "Cell not found" }, { status: 404 });
  }
  if (cell.ownerBrandId !== parsed.data.brandId) {
    return NextResponse.json({ error: "Это не клетка вашего бренда" }, { status: 403 });
  }
  if (!["HELD", "FADING"].includes(cell.state)) {
    return NextResponse.json(
      { error: "Клетку нельзя поддержать в текущем состоянии" },
      { status: 409 },
    );
  }
  if (access.primaryCategoryId !== cell.arena.seasonCategory.categoryId) {
    return NextResponse.json(
      { error: "Категория бренда не совпадает с категорией клетки" },
      { status: 403 },
    );
  }

  const outcome = await purchaseLand({
    intent: {
      kind: "cell_upkeep",
      cellId: id,
      brandId: parsed.data.brandId,
    },
    userId: session.user.id,
    amountKzt: parsed.data.amountKzt,
    seasonCategoryId: cell.arena.seasonCategoryId,
    paymentProvider: parsed.data.provider,
    phone: parsed.data.phone,
  });

  if (outcome.status === "error") {
    return NextResponse.json({ error: outcome.reason }, { status: 409 });
  }

  return NextResponse.json(outcome, {
    status: outcome.status === "applied" ? 200 : 202,
  });
}
