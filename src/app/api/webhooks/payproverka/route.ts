import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";
import {
  kaspiAmount,
  kaspiIsPaid,
  verifyPayProverkaWebhook,
} from "@/lib/payments/kaspi";

export const dynamic = "force-dynamic";

/**
 * PayProverka webhooks — same contract as neurokids /api/webhooks/payproverka.
 * Events: payment.success | payment.failed | payment.expired | payment.refunded
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("X-Webhook-Signature");

  if (!verifyPayProverkaWebhook(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = String(event.event ?? "");
  const paymentId = String(event.paymentId ?? "");
  const eventId = String(event.eventId ?? "");

  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  const order = await prisma.paymentOrder.findFirst({
    where: { paymentProvider: "kaspi", providerOrderId: paymentId },
  });

  if (!order) {
    return NextResponse.json({ ok: true, note: "no_matching_order" });
  }

  if (order.status === "PAID" && order.appliedAt) {
    return NextResponse.json({ ok: true, status: "already_processed", eventId });
  }

  if (eventName === "payment.success") {
    const amount =
      kaspiAmount({ amount: event.amount }) ?? order.amountKzt;
    if (amount !== order.amountKzt) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 409 });
    }
    const fulfilled = await fulfillPaidOrder(order.id, paymentId, amount);
    if (!fulfilled) {
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "paid" });
  }

  if (eventName === "payment.failed" || eventName === "payment.expired") {
    if (order.status === "PENDING") {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
    }
    return NextResponse.json({ ok: true, status: "failed" });
  }

  return NextResponse.json({ ok: true, event: eventName });
}
