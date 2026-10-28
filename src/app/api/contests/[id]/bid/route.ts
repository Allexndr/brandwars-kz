import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkoutProviderSchema } from "@/lib/payments/methods";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { purchaseLand } from "@/lib/land-purchase";
import { assertBrandAccess } from "@/lib/brand-access";
import { TERRITORY_CELL_PRICE_KZT } from "@/lib/category-catalog";

export const dynamic = "force-dynamic";

const schema = z.object({
  brandId: z.string(),
  amountKzt: z.number().int().min(500).multipleOf(500),
  provider: checkoutProviderSchema.default("prodamus"),
  phone: z.string().min(10).max(30).optional(),
});

/**
 * Reinforce inside an open window — this is the defence side of the mechanic,
 * and the reason a contest earns twice: the incumbent pays to hold ground it
 * already owns.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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

  if (parsed.data.amountKzt < TERRITORY_CELL_PRICE_KZT) {
    return NextResponse.json(
      { error: "Минимальное усиление", minimumKzt: TERRITORY_CELL_PRICE_KZT },
      { status: 400 },
    );
  }

  const access = await assertBrandAccess(session.user.id, parsed.data.brandId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const contest = await prisma.contest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      closesAt: true,
      challengerBrandId: true,
      defenderBrandId: true,
      arena: {
        select: {
          seasonCategoryId: true,
          seasonCategory: { select: { categoryId: true } },
        },
      },
    },
  });

  if (!contest) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }
  if (access.primaryCategoryId !== contest.arena.seasonCategory.categoryId) {
    return NextResponse.json(
      { error: "Бренд может участвовать только в своей категории" },
      { status: 403 },
    );
  }
  if (contest.status !== "OPEN" || contest.closesAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Окно закрыто" }, { status: 409 });
  }

  const isParticipant =
    contest.challengerBrandId === parsed.data.brandId ||
    contest.defenderBrandId === parsed.data.brandId;

  if (!isParticipant) {
    return NextResponse.json(
      { error: "Этот бренд не участвует в окне" },
      { status: 403 },
    );
  }

  const outcome = await purchaseLand({
    intent: {
      kind: "contest_bid",
      contestId: contest.id,
      brandId: parsed.data.brandId,
    },
    userId: session.user.id,
    amountKzt: parsed.data.amountKzt,
    seasonCategoryId: contest.arena.seasonCategoryId,
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
