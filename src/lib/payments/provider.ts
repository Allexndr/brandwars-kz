export type PaymentOrderResult = {
  orderId: string;
  providerOrderId: string;
  paymentUrl?: string;
  mode?: "redirect" | "kaspi_invoice";
  message?: string;
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
    phone?: string;
    name?: string;
    email?: string;
    description?: string;
    ip?: string;
  }): Promise<PaymentOrderResult>;
  verifyWebhook(body: unknown, headers: Headers): Promise<WebhookPayload | null>;
  getStatus(providerOrderId: string): Promise<PaymentOrderResult["status"]>;
}

export function getPaymentProvider(requested?: string): PaymentProvider {
  const mode = (requested ?? process.env.PAYMENT_PROVIDER ?? "test").toLowerCase();

  if (mode === "prodamus" || mode === "card") {
    const cardDefault = (
      process.env.PAYMENT_CARD_PROVIDER ?? "prodamus"
    ).toLowerCase();
    const wantUnicorn = mode === "card" && cardDefault === "unicorn";

    if (wantUnicorn) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isUnicornReady, unicornPaymentProvider } = require("./unicorn") as {
        isUnicornReady: () => boolean;
        unicornPaymentProvider: PaymentProvider;
      };
      if (isUnicornReady()) return unicornPaymentProvider;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isCardCheckoutReady, prodamusPaymentProvider } = require("./prodamus") as {
      isCardCheckoutReady: () => boolean;
      prodamusPaymentProvider: PaymentProvider;
    };
    if (isCardCheckoutReady() || mode === "prodamus") return prodamusPaymentProvider;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isUnicornReady, unicornPaymentProvider } = require("./unicorn") as {
      isUnicornReady: () => boolean;
      unicornPaymentProvider: PaymentProvider;
    };
    if (isUnicornReady()) return unicornPaymentProvider;
    return prodamusPaymentProvider;
  }

  if (mode === "unicorn") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { unicornPaymentProvider } = require("./unicorn") as {
      unicornPaymentProvider: PaymentProvider;
    };
    return unicornPaymentProvider;
  }

  if (mode === "kaspi" || mode === "payproverka") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { kaspiPaymentProvider } = require("./kaspi") as {
      kaspiPaymentProvider: PaymentProvider;
    };
    return kaspiPaymentProvider;
  }

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
