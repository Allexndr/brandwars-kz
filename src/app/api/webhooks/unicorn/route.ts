import { NextRequest, NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";
import {
  parseUnicornWebhook,
  verifyUnicornWebhookSecret,
} from "@/lib/payments/unicorn";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (
    !verifyUnicornWebhookSecret(
      request.nextUrl.searchParams.get("secret") ?? "",
    )
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 100_000) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  const raw = await request.text();
  const payload = parseUnicornWebhook(raw);
  if (!payload.orderId || !payload.paid) {
    return new NextResponse("OK", { status: 200 });
  }
  if (payload.amountKzt === null || payload.amountKzt <= 0) {
    return new NextResponse("Amount required", { status: 400 });
  }

  const fulfilled = await fulfillPaidOrder(
    payload.orderId,
    payload.orderId,
    payload.amountKzt,
  );
  if (!fulfilled) {
    return new NextResponse("Order or amount mismatch", { status: 409 });
  }

  return new NextResponse("OK", { status: 200 });
}
