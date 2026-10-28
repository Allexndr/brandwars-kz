import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    paidAgg,
    paid7d,
    paid30d,
    byProvider,
    pendingCount,
    stuckPaid,
    openModeration,
    brandCount,
    companyProfiles,
    recentPayments,
    withdrawalsPending,
    earningsAvailable,
  ] = await Promise.all([
    prisma.paymentOrder.aggregate({
      where: { status: "PAID" },
      _sum: { amountKzt: true },
      _count: true,
    }),
    prisma.paymentOrder.aggregate({
      where: { status: "PAID", createdAt: { gte: since7d } },
      _sum: { amountKzt: true },
      _count: true,
    }),
    prisma.paymentOrder.aggregate({
      where: { status: "PAID", createdAt: { gte: since30d } },
      _sum: { amountKzt: true },
      _count: true,
    }),
    prisma.paymentOrder.groupBy({
      by: ["paymentProvider", "status"],
      _sum: { amountKzt: true },
      _count: true,
    }),
    prisma.paymentOrder.count({ where: { status: "PENDING" } }),
    prisma.paymentOrder.count({
      where: { status: "PAID", appliedAt: null },
    }),
    prisma.moderationCase.count({ where: { status: "OPEN" } }),
    prisma.brand.count({ where: { isActive: true } }),
    prisma.billingProfile.count({ where: { kind: "COMPANY" } }),
    prisma.paymentOrder.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        brand: { select: { id: true, name: true, slug: true } },
        brandClaim: { select: { id: true, brandName: true, status: true } },
      },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amountKzt: true },
      _count: true,
    }),
    prisma.brandEarningsWallet.aggregate({
      _sum: { availableKzt: true, reservedKzt: true },
    }),
  ]);

  const providerTotals = byProvider.reduce<
    Record<string, { paidKzt: number; paidCount: number; pendingCount: number }>
  >((acc, row) => {
    const key = row.paymentProvider || "unknown";
    if (!acc[key]) acc[key] = { paidKzt: 0, paidCount: 0, pendingCount: 0 };
    if (row.status === "PAID") {
      acc[key].paidKzt += row._sum.amountKzt ?? 0;
      acc[key].paidCount += row._count;
    }
    if (row.status === "PENDING") acc[key].pendingCount += row._count;
    return acc;
  }, {});

  return NextResponse.json({
    totals: {
      paidKzt: paidAgg._sum.amountKzt ?? 0,
      paidCount: paidAgg._count,
      paid7dKzt: paid7d._sum.amountKzt ?? 0,
      paid7dCount: paid7d._count,
      paid30dKzt: paid30d._sum.amountKzt ?? 0,
      paid30dCount: paid30d._count,
      pendingCount,
      stuckPaidCount: stuckPaid,
      openModeration,
      brandCount,
      companyProfiles,
      withdrawalsPendingKzt: withdrawalsPending._sum.amountKzt ?? 0,
      withdrawalsPendingCount: withdrawalsPending._count,
      earningsAvailableKzt: earningsAvailable._sum.availableKzt ?? 0,
      earningsReservedKzt: earningsAvailable._sum.reservedKzt ?? 0,
    },
    byProvider: providerTotals,
    recentPayments,
  });
}
