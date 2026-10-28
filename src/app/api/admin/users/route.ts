import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import {
  requireAdminSession,
  requireSuperAdminSession,
} from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const role = request.nextUrl.searchParams.get("role")?.trim() ?? "";
  const take = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("take") || 50), 1),
    200,
  );

  const users = await prisma.user.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        role && Object.values(UserRole).includes(role as UserRole)
          ? { role: role as UserRole }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          paymentOrders: true,
        },
      },
    },
  });

  const brandCounts = await prisma.brand.groupBy({
    by: ["ownerUserId"],
    where: {
      ownerUserId: { in: users.map((u) => u.id) },
    },
    _count: true,
  });
  const brandCountMap = new Map(
    brandCounts.map((row) => [row.ownerUserId, row._count]),
  );

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      _count: {
        paymentOrders: user._count.paymentOrders,
        ownedBrands: brandCountMap.get(user.id) ?? 0,
      },
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireSuperAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden — нужен ADMIN" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    role?: UserRole;
  };

  if (!body.userId || !body.role) {
    return NextResponse.json({ error: "userId and role required" }, { status: 400 });
  }
  if (!Object.values(UserRole).includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (body.userId === session.user.id && body.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Нельзя снять ADMIN с самого себя" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: body.userId },
    data: { role: body.role },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, user });
}
