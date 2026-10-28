import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.FOUNDERS_SEED_SECRET?.trim();
  const received = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!expected || !received || expected !== received) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    q?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const q = body.q?.trim();

  const orders = await prisma.paymentOrder.findMany({
    where: {
      OR: [
        email ? { user: { email: { equals: email, mode: "insensitive" } } } : undefined,
        q
          ? {
              OR: [
                { brandClaim: { brandName: { contains: q, mode: "insensitive" } } },
                { brandClaim: { websiteUrl: { contains: q, mode: "insensitive" } } },
                { brand: { name: { contains: q, mode: "insensitive" } } },
                { brand: { websiteUrl: { contains: q, mode: "insensitive" } } },
              ],
            }
          : undefined,
      ].filter(Boolean) as object[],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { email: true } },
      brand: { select: { name: true, slug: true, websiteUrl: true } },
      brandClaim: {
        select: {
          brandName: true,
          websiteUrl: true,
          status: true,
          bidAmountKzt: true,
        },
      },
      transaction: { select: { type: true, status: true, amountKzt: true } },
    },
  });

  const recent = await prisma.paymentOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amountKzt: true,
      status: true,
      paymentProvider: true,
      appliedAt: true,
      createdAt: true,
      providerOrderId: true,
      user: { select: { email: true } },
      brandClaim: { select: { brandName: true, websiteUrl: true } },
    },
  });

  const byProvider = await prisma.paymentOrder.groupBy({
    by: ["paymentProvider", "status"],
    _count: { _all: true },
    _sum: { amountKzt: true },
  });

  return NextResponse.json({
    matched: orders.map((o) => ({
      id: o.id,
      amountKzt: o.amountKzt,
      status: o.status,
      provider: o.paymentProvider,
      appliedAt: o.appliedAt,
      createdAt: o.createdAt,
      providerOrderId: o.providerOrderId,
      email: o.user.email,
      claim: o.brandClaim,
      brand: o.brand,
      tx: o.transaction,
    })),
    recent,
    byProvider,
  });
}
