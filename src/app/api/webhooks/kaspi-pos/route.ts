import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";
import {
  parseKaspiPosWebhook,
  verifyKaspiPosWebhook,
} from "@/lib/payments/kaspi-pos";

export const dynamic = "force-dynamic";

/**
 * Webhooks from self-hosted kaspi-pos-automation (payment.success / failed / …).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const signature = request.headers.get("x-webhook-signature");
  if (!verifyKaspiPosWebhook(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = parseKaspiPosWebhook(body);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const order = await prisma.paymentOrder.findFirst({
    where: {
      paymentProvider: "kaspi",
      providerOrderId: payload.paymentId,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "PAID" && order.appliedAt) {
    return NextResponse.json({ status: "already_processed" });
  }

  if (payload.event === "payment.success") {
    const amount = payload.amount ?? order.amountKzt;
    if (amount !== order.amountKzt) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 409 });
    }
    const fulfilled = await fulfillPaidOrder(order.id, payload.paymentId, amount);
    if (!fulfilled) {
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 409 });
    }
    return NextResponse.json({ status: "paid" });
  }

  if (
    payload.event === "payment.failed" ||
    payload.event === "payment.expired"
  ) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "ignored", event: payload.event });
}
