import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { recalculateCategory } from "@/lib/territory";

export const dynamic = "force-dynamic";

async function markOrderPaid(orderId: string, providerOrderId: string) {
  const order = await prisma.paymentOrder.findFirst({
    where: {
      OR: [{ id: orderId }, { providerOrderId }],
    },
  });

  if (!order) return null;
  if (order.status === "PAID") return order;

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { status: "PAID" },
  });

  if (order.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: order.brandId },
    });

    const activeSeason = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
    });

    if (brand && activeSeason) {
      const seasonCategory = await prisma.seasonCategory.findUnique({
        where: {
          seasonId_categoryId: {
            seasonId: activeSeason.id,
            categoryId: brand.primaryCategoryId,
          },
        },
      });

      await prisma.transaction.create({
        data: {
          userId: order.userId,
          brandId: order.brandId,
          seasonCategoryId: seasonCategory?.id,
          type: "TOP_UP",
          amountKzt: order.amountKzt,
          status: "COMPLETED",
          paymentProvider: order.paymentProvider,
          providerPaymentId: order.providerOrderId ?? undefined,
        },
      });

      if (seasonCategory) {
        await recalculateCategory(seasonCategory.id);
      }
    }
  }

  return order;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = getPaymentProvider();
  const payload = await provider.verifyWebhook(body, request.headers);

  if (!payload) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  if (payload.idempotencyKey) {
    const existing = await prisma.paymentOrder.findUnique({
      where: { idempotencyKey: payload.idempotencyKey },
    });
    if (existing?.status === "PAID") {
      return NextResponse.json({ status: "already_processed" });
    }
  }

  if (payload.status === "paid") {
    await markOrderPaid(payload.orderId, payload.providerOrderId);
    return NextResponse.json({ status: "paid" });
  }

  await prisma.paymentOrder.updateMany({
    where: { providerOrderId: payload.providerOrderId },
    data: { status: payload.status.toUpperCase() as "FAILED" },
  });

  return NextResponse.json({ status: payload.status });
}
