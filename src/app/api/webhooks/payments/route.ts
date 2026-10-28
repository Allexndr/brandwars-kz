import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Attach raw for Lemon HMAC verification
  if (body && typeof body === "object") {
    (body as { _raw?: string })._raw = raw;
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
    if (existing?.status === "PAID" && existing.appliedAt) {
      return NextResponse.json({ status: "already_processed" });
    }
  }

  if (payload.status === "paid") {
    const fulfilled = await fulfillPaidOrder(
      payload.orderId,
      payload.providerOrderId,
      payload.amountKzt,
    );
    if (!fulfilled) {
      return NextResponse.json(
        { error: "Payment order or amount mismatch" },
        { status: 409 },
      );
    }
    return NextResponse.json({ status: "paid" });
  }

  await prisma.paymentOrder.updateMany({
    where: { providerOrderId: payload.providerOrderId },
    data: { status: payload.status.toUpperCase() as "FAILED" },
  });

  return NextResponse.json({ status: payload.status });
}
