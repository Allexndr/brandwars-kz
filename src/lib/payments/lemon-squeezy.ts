import type { PaymentProvider, PaymentOrderResult, WebhookPayload } from "./provider";
import crypto from "crypto";

/**
 * Lemon Squeezy hosted checkout — Card, Google Pay, Apple Pay, PayPal appear automatically.
 * Docs: https://docs.lemonsqueezy.com/api/checkouts/create-checkout
 *
 * Env:
 *   LEMONSQUEEZY_API_KEY
 *   LEMONSQUEEZY_STORE_ID
 *   LEMONSQUEEZY_VARIANT_ID  (pay-what-you-want / one-time variant)
 *   LEMONSQUEEZY_WEBHOOK_SECRET
 */
export const lemonSqueezyProvider: PaymentProvider = {
  name: "lemonsqueezy",

  async createOrder({ amountKzt, userId, brandId, idempotencyKey, metadata }) {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      throw new Error(
        "Lemon Squeezy не настроен: задайте LEMONSQUEEZY_API_KEY, STORE_ID, VARIANT_ID",
      );
    }

    // KZT on Lemon uses 2 decimal places → amount in tiyn
    const customPrice = Math.max(100, Math.round(amountKzt * 100));
    const appUrl = process.env.NEXTAUTH_URL ?? "https://brand-wars.vercel.app";

    const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            custom_price: customPrice,
            checkout_options: {
              embed: false,
              media: false,
              logo: true,
              desc: true,
              discount: false,
              button_color: "#C2410C",
            },
            checkout_data: {
              custom: {
                user_id: userId,
                brand_id: brandId ?? "",
                order_key: idempotencyKey,
                amount_kzt: String(amountKzt),
                ...(metadata ?? {}),
              },
            },
            product_options: {
              name: "BrandWars.kz — сила поддержки",
              description: `Пополнение Battle Power на ${amountKzt.toLocaleString("ru-KZ")} ₸`,
              redirect_url: `${appUrl}/ru/dashboard?paid=1`,
              receipt_button_text: "Открыть кабинет",
              receipt_link_url: `${appUrl}/ru/dashboard`,
            },
          },
          relationships: {
            store: { data: { type: "stores", id: String(storeId) } },
            variant: { data: { type: "variants", id: String(variantId) } },
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Lemon Squeezy checkout failed: ${res.status} ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      data: { id: string; attributes: { url: string } };
    };

    return {
      orderId: idempotencyKey,
      providerOrderId: json.data.id,
      paymentUrl: json.data.attributes.url,
      status: "pending" as const,
    } satisfies PaymentOrderResult;
  },

  async verifyWebhook(body: unknown, headers: Headers): Promise<WebhookPayload | null> {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret || !body || typeof body !== "object") return null;

    const raw = typeof (body as { _raw?: string })._raw === "string"
      ? (body as { _raw: string })._raw
      : JSON.stringify(body);

    const signature = headers.get("x-signature") ?? "";
    if (!signature) return null;

    const digest = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    try {
      const expected = Buffer.from(digest, "hex");
      const received = Buffer.from(signature, "hex");
      if (
        expected.length !== received.length ||
        !crypto.timingSafeEqual(expected, received)
      ) {
        return null;
      }
    } catch {
      return null;
    }

    const event = body as {
      meta?: { event_name?: string; custom_data?: Record<string, string> };
      data?: {
        id?: string;
        attributes?: {
          status?: string;
          subtotal?: number;
          total?: number;
          first_order_item?: { price?: number };
        };
      };
    };

    const eventName = event.meta?.event_name ?? "";
    if (!["order_created", "order_paid"].includes(eventName)) {
      return null;
    }
    if (event.data?.attributes?.status !== "paid") return null;

    const custom = event.meta?.custom_data ?? {};
    const amountKzt = Number(custom.amount_kzt ?? 0);
    const orderId = custom.order_key;
    const providerOrderId = event.data?.id;
    const providerAmountKzt = Math.round(
      (event.data?.attributes?.first_order_item?.price ??
        event.data?.attributes?.subtotal ??
        event.data?.attributes?.total ??
        0) / 100,
    );

    if (!orderId || !providerOrderId || amountKzt <= 0 || providerAmountKzt <= 0) {
      return null;
    }
    if (providerAmountKzt !== amountKzt) return null;

    return {
      orderId,
      providerOrderId,
      status: "paid",
      amountKzt,
      idempotencyKey: orderId,
    };
  },

  async getStatus() {
    return "pending";
  },
};
