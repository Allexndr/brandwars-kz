import { NextRequest, NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";
import { verifyProdamusWebhook } from "@/lib/payments/prodamus";

export const dynamic = "force-dynamic";

function fieldTokens(name: string): string[] {
  return [...name.matchAll(/([^[\]]+)/g)].map((match) => match[1]);
}

function setNested(target: Record<string, unknown>, name: string, value: string) {
  const tokens = fieldTokens(name);
  let current: Record<string, unknown> | unknown[] = target;
  tokens.forEach((token, index) => {
    const last = index === tokens.length - 1;
    if (last) {
      (current as Record<string, unknown>)[token] = value;
      return;
    }
    const nextIsIndex = /^\d+$/.test(tokens[index + 1]);
    const record = current as Record<string, unknown>;
    if (record[token] === undefined) record[token] = nextIsIndex ? [] : {};
    current = record[token] as Record<string, unknown> | unknown[];
  });
}

function parsePayload(raw: string, contentType: string): Record<string, unknown> {
  if (contentType.includes("application/json")) {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  }
  const result: Record<string, unknown> = {};
  new URLSearchParams(raw).forEach((value, key) => setNested(result, key, value));
  return result;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 200_000) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  const signature =
    request.headers.get("sign") ?? request.headers.get("x-signature") ?? "";
  if (!signature) return new NextResponse("Missing signature", { status: 401 });

  const raw = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = parsePayload(raw, request.headers.get("content-type") ?? "");
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const result = await verifyProdamusWebhook(payload, signature);
  if (!result) {
    return new NextResponse("Payment verifier unavailable", { status: 503 });
  }
  if (!result.valid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  if (!result.paid || !result.orderId) {
    return new NextResponse("OK", { status: 200 });
  }

  const fulfilled = await fulfillPaidOrder(
    result.orderId,
    result.orderId,
    result.amount,
  );
  if (!fulfilled) {
    return new NextResponse("Order or amount mismatch", { status: 409 });
  }
  return new NextResponse("OK", { status: 200 });
}
