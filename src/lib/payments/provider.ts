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
    metadata?: Record<string, unknown>;
  }): Promise<PaymentOrderResult>;
  verifyWebhook(body: unknown, headers: Headers): Promise<WebhookPayload | null>;
  getStatus(providerOrderId: string): Promise<PaymentOrderResult["status"]>;
}

export function getPaymentProvider(): PaymentProvider {
  const mode = process.env.PAYMENT_PROVIDER ?? "test";
  if (mode === "test" || process.env.PAYMENT_TEST_MODE === "true") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { testPaymentProvider } = require("./test-provider") as {
      testPaymentProvider: PaymentProvider;
    };
    return testPaymentProvider;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { testPaymentProvider } = require("./test-provider") as {
    testPaymentProvider: PaymentProvider;
  };
  return testPaymentProvider;
}
