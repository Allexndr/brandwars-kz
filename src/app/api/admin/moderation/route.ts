import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isModerator } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isModerator(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cases = await prisma.moderationCase.findMany({
    where: { status: "OPEN" },
    include: {
      brandClaim: true,
      reviewer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const categories = await prisma.category.findMany();
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const claimIds = cases.map((c) => c.brandClaim.id);
  const idempotencyKeys = claimIds.map((id) => `claim_${id}`);

  const paymentOrders = await prisma.paymentOrder.findMany({
    where: { idempotencyKey: { in: idempotencyKeys } },
  });
  const paymentMap = Object.fromEntries(
    paymentOrders.map((p) => [p.idempotencyKey.replace("claim_", ""), p]),
  );

  const enrichedCases = cases.map((c) => {
    const claim = c.brandClaim;
    const payment = paymentMap[claim.id];
    const category = categoryMap[claim.categoryId];
    const isPaid =
      (claim.metadata as Record<string, unknown> | null)?.paid === true ||
      payment?.status === "PAID";

    return {
      ...c,
      brandClaim: {
        ...claim,
        categoryName: category?.continentRu ?? category?.nameRu ?? claim.categoryId,
        categorySlug: category?.slug,
        isPaid,
        paymentStatus: payment?.status ?? (isPaid ? "PAID" : "UNPAID"),
      },
    };
  });

  return NextResponse.json({ cases: enrichedCases });
}
