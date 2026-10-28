import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";
import {
  getKaspiInvoice,
  kaspiAmount,
  kaspiIsPaid,
  kaspiIsTerminalFailure,
  kaspiStatus,
} from "@/lib/payments/kaspi";
import { verifyPaymentStatusToken } from "@/lib/payments/status-token";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
  const paymentId = request.nextUrl.searchParams.get("paymentId")?.trim();
  const token = request.nextUrl.searchParams.get("token")?.trim();

  if (!orderId && !paymentId) {
    return NextResponse.json(
      { error: "orderId or paymentId is required" },
      { status: 400 },
    );
  }

  const order = await prisma.paymentOrder.findFirst({
    where: orderId
      ? { id: orderId }
      : { paymentProvider: "kaspi", providerOrderId: paymentId },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.paymentProvider !== "kaspi" || !order.providerOrderId) {
    return NextResponse.json({ error: "Not a Kaspi order" }, { status: 400 });
  }

  const session = await auth();
  const ownsOrder = session?.user?.id === order.userId;
  const tokenOk = verifyPaymentStatusToken(order.id, token);
  if (!ownsOrder && !tokenOk) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.status === "PAID" && order.appliedAt) {
    return NextResponse.json({
      paid: true,
      success: true,
      paymentId: order.providerOrderId,
      status: "paid",
      isPaid: true,
    });
  }

  const invoice = await getKaspiInvoice(order.providerOrderId);
  const amount = kaspiAmount(invoice);
  if (kaspiIsPaid(invoice)) {
    if (amount !== order.amountKzt) {
      return NextResponse.json(
        { error: "Сумма счёта не совпадает с заказом", status: "amount_mismatch" },
        { status: 409 },
      );
    }
    const fulfilled = await fulfillPaidOrder(order.id, order.providerOrderId, amount);
    if (!fulfilled) {
      return NextResponse.json({ error: "Не удалось применить оплату" }, { status: 409 });
    }
    return NextResponse.json({
      paid: true,
      success: true,
      paymentId: order.providerOrderId,
      status: kaspiStatus(invoice) || "paid",
      amount,
      isPaid: true,
    });
  }

  return NextResponse.json({
    paid: false,
    success: true,
    paymentId: order.providerOrderId,
    status: kaspiStatus(invoice) || "pending",
    amount: kaspiAmount(invoice),
    isPaid: false,
    terminal: kaspiIsTerminalFailure(invoice),
  });
}
