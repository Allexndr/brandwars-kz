import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminSession,
  requireSuperAdminSession,
} from "@/lib/admin/session";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const order = await prisma.paymentOrder.findFirst({
    where: {
      OR: [{ id }, { idempotencyKey: id }, { providerOrderId: id }],
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          billingProfile: true,
          wallet: { select: { id: true, balance: true } },
        },
      },
      brand: {
        select: {
          id: true,
          name: true,
          slug: true,
          websiteUrl: true,
          verificationStatus: true,
          primaryCategory: { select: { nameRu: true, slug: true } },
        },
      },
      brandClaim: {
        include: {
          moderation: true,
          submitter: { select: { id: true, email: true, name: true } },
        },
      },
      transaction: true,
      invoice: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const audit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityId: order.id },
        ...(order.brandClaim ? [{ entityId: order.brandClaim.id }] : []),
        ...(order.brandId ? [{ entityId: order.brandId }] : []),
        { entityId: order.userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const timeline = [
    {
      at: order.createdAt,
      kind: "payment_created",
      title: "Создан платёж",
      detail: `${order.paymentProvider} · ${order.amountKzt} ₸ · ${order.status}`,
    },
    ...(order.appliedAt
      ? [
          {
            at: order.appliedAt,
            kind: "payment_applied",
            title: "Оплата применена",
            detail: "fulfillPaidOrder",
          },
        ]
      : []),
    ...audit.map((row) => ({
      at: row.createdAt,
      kind: row.action,
      title: row.action,
      detail: [row.entity, row.entityId].filter(Boolean).join(":"),
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return NextResponse.json({ order, timeline });
}

/**
 * Super-admin write actions.
 * apply — fulfill stuck PAID / force-apply after marking paid
 * mark_failed — close PENDING as FAILED
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  const session = await requireSuperAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden — нужен ADMIN" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };

  const order = await prisma.paymentOrder.findFirst({
    where: {
      OR: [{ id }, { idempotencyKey: id }, { providerOrderId: id }],
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "apply") {
    if (order.status === "PENDING") {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });
    }
    const fulfilled = await fulfillPaidOrder(
      order.id,
      order.providerOrderId ?? order.id,
      order.amountKzt,
    );
    if (!fulfilled) {
      return NextResponse.json(
        { error: "Не удалось применить (уже применено или ошибка)" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, status: "applied" });
  }

  if (body.action === "mark_failed") {
    if (order.status === "PAID" && order.appliedAt) {
      return NextResponse.json(
        { error: "Уже оплачен и применён — нельзя пометить failed" },
        { status: 400 },
      );
    }
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ ok: true, status: "failed" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
