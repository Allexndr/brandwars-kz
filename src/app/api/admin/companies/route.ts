import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const kind = request.nextUrl.searchParams.get("kind");
  const take = Math.min(Number(request.nextUrl.searchParams.get("take") || 50) || 50, 200);

  const where: Prisma.UserWhereInput = {
    OR: [
      { paymentOrders: { some: {} } },
      { billingProfile: { isNot: null } },
      { brandClaims: { some: {} } },
      { transactions: { some: {} } },
    ],
  };

  if (kind === "company") {
    where.billingProfile = { is: { kind: "COMPANY" } };
  } else if (kind === "individual") {
    where.billingProfile = { is: { kind: "INDIVIDUAL" } };
  }

  if (q) {
    where.AND = [
      {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          {
            billingProfile: {
              is: { companyName: { contains: q, mode: "insensitive" } },
            },
          },
          { billingProfile: { is: { bin: { contains: q } } } },
        ],
      },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      billingProfile: true,
      wallet: { select: { balance: true } },
      _count: {
        select: {
          paymentOrders: true,
          brandClaims: true,
          transactions: true,
        },
      },
    },
  });

  const userIds = users.map((u) => u.id);
  const [paidByUser, brands] = await Promise.all([
    prisma.paymentOrder.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "PAID" },
      _sum: { amountKzt: true },
      _count: true,
    }),
    prisma.brand.findMany({
      where: { ownerUserId: { in: userIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        verificationStatus: true,
        isActive: true,
        ownerUserId: true,
      },
    }),
  ]);

  const paidMap = Object.fromEntries(
    paidByUser.map((row) => [
      row.userId,
      { paidKzt: row._sum.amountKzt ?? 0, paidCount: row._count },
    ]),
  );
  const brandsByUser = brands.reduce<Record<string, typeof brands>>((acc, brand) => {
    const uid = brand.ownerUserId;
    if (!uid) return acc;
    if (!acc[uid]) acc[uid] = [];
    acc[uid].push(brand);
    return acc;
  }, {});

  return NextResponse.json({
    companies: users.map((user) => ({
      ...user,
      brands: brandsByUser[user.id] ?? [],
      paidKzt: paidMap[user.id]?.paidKzt ?? 0,
      paidCount: paidMap[user.id]?.paidCount ?? 0,
    })),
  });
}
