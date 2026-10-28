export type PaymentOrderResult = {
  orderId: string;
  providerOrderId: string;
  paymentUrl?: string;
  status: "pending" | "paid" | "failed";
};

export type WebhookPayload = {
  orderId: string;
  providerOrderId: string;
  status: "paid" | "failed" | "refunded" | "chargeback" | "disputed";
  amountKzt: number;
  idempotencyKey?: string;
};

export interface PaymentProvider {
  name: string;
  createOrder(params: {
    amountKzt: number;
    userId: string;
    brandId?: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentOrderResult>;
  verifyWebhook(body: unknown, headers: Headers): Promise<WebhookPayload | null>;
  getStatus(providerOrderId: string): Promise<PaymentOrderResult["status"]>;
}

export function getPaymentProvider(): PaymentProvider {
  const mode = (process.env.PAYMENT_PROVIDER ?? "test").toLowerCase();
  const lemonReady =
    Boolean(process.env.LEMONSQUEEZY_API_KEY) &&
    Boolean(process.env.LEMONSQUEEZY_STORE_ID) &&
    Boolean(process.env.LEMONSQUEEZY_VARIANT_ID);

  if (mode === "lemonsqueezy" && lemonReady) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { lemonSqueezyProvider } = require("./lemon-squeezy") as {
      lemonSqueezyProvider: PaymentProvider;
    };
    return lemonSqueezyProvider;
  }

  // Prefer Lemon when configured even if provider string not set
  if (lemonReady && process.env.PAYMENT_TEST_MODE !== "true") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { lemonSqueezyProvider } = require("./lemon-squeezy") as {
      lemonSqueezyProvider: PaymentProvider;
    };
    return lemonSqueezyProvider;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { testPaymentProvider } = require("./test-provider") as {
    testPaymentProvider: PaymentProvider;
  };
  return testPaymentProvider;
}
