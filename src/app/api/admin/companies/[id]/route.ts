import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const brandBySlugOrId = await prisma.brand.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { ownerUserId: true },
  });

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id },
        { email: id },
        ...(brandBySlugOrId?.ownerUserId
          ? [{ id: brandBySlugOrId.ownerUserId }]
          : []),
      ],
    },
    include: {
      billingProfile: true,
      wallet: {
        include: {
          transactions: { orderBy: { createdAt: "desc" }, take: 30 },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const brands = await prisma.brand.findMany({
    where: { ownerUserId: user.id },
    include: {
      primaryCategory: { select: { nameRu: true, slug: true } },
      territories: {
        include: {
          seasonCategory: {
            include: {
              category: { select: { nameRu: true } },
              season: true,
            },
          },
        },
      },
      cells: {
        take: 40,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          q: true,
          r: true,
          state: true,
          layer: true,
          priceKzt: true,
          lastUpkeepAt: true,
        },
      },
    },
  });

  const brandIds = brands.map((b) => b.id);

  const [paymentOrders, claims, transactions, invoices, audit] =
    await Promise.all([
      prisma.paymentOrder.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          brand: { select: { id: true, name: true, slug: true } },
          brandClaim: { select: { id: true, brandName: true, status: true } },
          invoice: { select: { id: true, number: true } },
          transaction: { select: { id: true, type: true, status: true } },
        },
      }),
      prisma.brandClaim.findMany({
        where: { submittedById: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          moderation: true,
          paymentOrder: {
            select: {
              id: true,
              status: true,
              amountKzt: true,
              paymentProvider: true,
            },
          },
        },
      }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.invoice.findMany({
        where: { userId: user.id },
        orderBy: { issuedAt: "desc" },
        take: 50,
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { userId: user.id },
            { entityId: user.id },
            ...(brandIds.length ? [{ entityId: { in: brandIds } }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

  const paidByProvider = paymentOrders
    .filter((o) => o.status === "PAID")
    .reduce<Record<string, { count: number; amountKzt: number }>>((acc, o) => {
      const key = o.paymentProvider;
      if (!acc[key]) acc[key] = { count: 0, amountKzt: 0 };
      acc[key].count += 1;
      acc[key].amountKzt += o.amountKzt;
      return acc;
    }, {});

  const process = [
    ...paymentOrders.map((o) => ({
      at: o.createdAt,
      type: "payment" as const,
      id: o.id,
      title: `Платёж ${o.paymentProvider}`,
      status: o.status,
      amountKzt: o.amountKzt,
      href: `/admin/payments/${o.id}`,
    })),
    ...claims.map((c) => ({
      at: c.createdAt,
      type: "claim" as const,
      id: c.id,
      title: `Заявка «${c.brandName}»`,
      status: c.status,
      amountKzt: c.bidAmountKzt,
      href: `/admin/moderation`,
    })),
    ...transactions.map((t) => ({
      at: t.createdAt,
      type: "transaction" as const,
      id: t.id,
      title: t.type,
      status: t.status,
      amountKzt: t.amountKzt,
      href: t.paymentOrderId ? `/admin/payments/${t.paymentOrderId}` : null,
    })),
    ...invoices.map((inv) => ({
      at: inv.issuedAt,
      type: "invoice" as const,
      id: inv.id,
      title: `Счёт №${inv.number}`,
      status: inv.actIssuedAt ? "ACT" : "ISSUED",
      amountKzt: inv.amountKzt,
      href: `/admin/payments/${inv.paymentOrderId}`,
    })),
    ...audit.map((a) => ({
      at: a.createdAt,
      type: "audit" as const,
      id: a.id,
      title: a.action,
      status: a.entity,
      amountKzt: null as number | null,
      href: null as string | null,
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return NextResponse.json({
    user: { ...user, brands },
    paymentOrders,
    claims,
    transactions,
    invoices,
    paidByProvider,
    process,
  });
}
