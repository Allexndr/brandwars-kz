import "server-only";

import crypto from "crypto";

function statusSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

/** Short HMAC so anonymous checkout can poll Kaspi without exposing all orders. */
export function paymentStatusToken(orderId: string): string {
  const secret = statusSecret();
  if (!secret) return "";
  return crypto
    .createHmac("sha256", secret)
    .update(`kaspi-status:${orderId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyPaymentStatusToken(
  orderId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const expected = paymentStatusToken(orderId);
  if (!expected || expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}
