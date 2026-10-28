import { NextRequest, NextResponse } from "next/server";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { requireAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "CHARGEBACK",
  "DISPUTED",
]);

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const provider = sp.get("provider");
  const q = sp.get("q")?.trim() ?? "";
  const stuck = sp.get("stuck") === "1";
  const take = Math.min(Number(sp.get("take") || 50) || 50, 200);

  const where: Prisma.PaymentOrderWhereInput = {};
  if (status && STATUSES.has(status)) {
    where.status = status as PaymentStatus;
  }
  if (provider) where.paymentProvider = provider;
  if (stuck) {
    where.status = "PAID";
    where.appliedAt = null;
  }
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { idempotencyKey: { contains: q } },
      { providerOrderId: { contains: q } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { brand: { name: { contains: q, mode: "insensitive" } } },
      { brandClaim: { brandName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.paymentOrder.findMany({
      where,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        brand: { select: { id: true, name: true, slug: true } },
        brandClaim: {
          select: { id: true, brandName: true, status: true, websiteUrl: true },
        },
        transaction: {
          select: { id: true, type: true, status: true, amountKzt: true },
        },
        invoice: {
          select: { id: true, number: true, payerName: true, payerBin: true },
        },
      },
    }),
    prisma.paymentOrder.count({ where }),
  ]);

  return NextResponse.json({ orders, total });
}
