import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmTestPayment } from "@/lib/payments/test-provider";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (
    process.env.PAYMENT_TEST_MODE !== "true" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    return NextResponse.json({ error: "Test mode only" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { providerOrderId?: string; orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const providerOrderId = body.providerOrderId;
  if (!providerOrderId) {
    return NextResponse.json({ error: "providerOrderId required" }, { status: 400 });
  }

  const payload = confirmTestPayment(providerOrderId);
  if (!payload) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = await prisma.paymentOrder.findFirst({
    where: {
      OR: [{ id: body.orderId }, { providerOrderId }],
      userId: session.user.id,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Payment order not found" }, { status: 404 });
  }

  await fulfillPaidOrder(order.id, providerOrderId);

  return NextResponse.json({ ok: true, status: "paid" });
}
