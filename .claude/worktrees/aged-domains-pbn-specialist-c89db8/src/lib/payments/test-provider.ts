import type { PaymentProvider, PaymentOrderResult, WebhookPayload } from "./provider";

const pendingOrders = new Map<
  string,
  { amountKzt: number; userId: string; brandId?: string; status: PaymentOrderResult["status"] }
>();

export const testPaymentProvider: PaymentProvider = {
  name: "test",

  async createOrder({ amountKzt, userId, brandId, idempotencyKey }) {
    const providerOrderId = `test_${idempotencyKey}`;
    pendingOrders.set(providerOrderId, {
      amountKzt,
      userId,
      brandId,
      status: "pending",
    });

    return {
      orderId: idempotencyKey,
      providerOrderId,
      paymentUrl: `/dashboard?confirmPayment=${providerOrderId}`,
      status: "pending",
    };
  },

  async verifyWebhook(body: unknown): Promise<WebhookPayload | null> {
    if (!body || typeof body !== "object") return null;
    const payload = body as Record<string, unknown>;
    const providerOrderId = String(payload.providerOrderId ?? "");
    const order = pendingOrders.get(providerOrderId);
    if (!order) return null;

    const status = String(payload.status ?? "paid") as WebhookPayload["status"];
    order.status = status === "paid" ? "paid" : "failed";

    return {
      orderId: String(payload.orderId ?? providerOrderId),
      providerOrderId,
      status,
      amountKzt: order.amountKzt,
      idempotencyKey: String(payload.idempotencyKey ?? ""),
    };
  },

  async getStatus(providerOrderId: string) {
    return pendingOrders.get(providerOrderId)?.status ?? "pending";
  },
};

export function confirmTestPayment(providerOrderId: string): WebhookPayload | null {
  const order = pendingOrders.get(providerOrderId);
  if (!order) return null;
  order.status = "paid";
  return {
    orderId: providerOrderId,
    providerOrderId,
    status: "paid",
    amountKzt: order.amountKzt,
  };
}
