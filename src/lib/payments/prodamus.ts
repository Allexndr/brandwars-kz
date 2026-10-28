import crypto from "crypto";
import type {
  PaymentOrderResult,
  PaymentProvider,
  WebhookPayload,
} from "./provider";

const DEFAULT_FORM_URL = "https://soulmetrica.proeducation.kz/";

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function secretKey(): string {
  return env("PRODAMUS_SECRET_KEY");
}

function formUrl(): string {
  return env("PRODAMUS_FORM_URL", DEFAULT_FORM_URL).replace(/\/?$/, "/");
}

export function isProdamusConfigured(): boolean {
  return Boolean(secretKey()) && /^https:\/\//i.test(formUrl());
}

export function isCardCheckoutReady(): boolean {
  return (
    isProdamusConfigured() ||
    Boolean(env("PAYMENT_BROKER_URL") && env("PAYMENT_BROKER_SECRET"))
  );
}

function normalizePhone(raw?: string): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits.length === 11 && digits.startsWith("7") ? `+${digits}` : "";
}

function appOrigin(): string {
  const raw = env("NEXTAUTH_URL", "https://brand-wars.vercel.app").replace(
    /\/$/,
    "",
  );
  return /^https:\/\//i.test(raw) ? raw : "https://brand-wars.vercel.app";
}

export function normalizeForSignature(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForSignature);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = normalizeForSignature(
        (value as Record<string, unknown>)[key],
      );
    }
    return sorted;
  }
  if (value == null) return "";
  return String(value);
}

export function signaturePayload(data: unknown): string {
  return JSON.stringify(normalizeForSignature(data)).replace(/\//g, "\\/");
}

export function signProdamus(data: unknown, key = secretKey()): string {
  const secret = key.trim();
  if (!secret) throw new Error("Prodamus secret key не задан");
  return crypto
    .createHmac("sha256", secret)
    .update(signaturePayload(data), "utf8")
    .digest("hex");
}

export function verifyProdamusSignature(
  data: unknown,
  signature: string,
  key = secretKey(),
): boolean {
  const received = String(signature || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received) || !key) return false;
  const expected = signProdamus(data, key);
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  );
}

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: unknown,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendQuery(params, `${key}[${index}]`, item);
    });
    return;
  }
  if (value && typeof value === "object") {
    Object.keys(value as Record<string, unknown>).forEach((childKey) => {
      appendQuery(
        params,
        key ? `${key}[${childKey}]` : childKey,
        (value as Record<string, unknown>)[childKey],
      );
    });
    return;
  }
  params.append(key, value == null ? "" : String(value));
}

export function createProdamusPaymentUrl(order: {
  id: string;
  sum: number;
  phone?: string;
  description?: string;
  successUrl: string;
  failUrl: string;
  notifyUrl: string;
}): string {
  if (!isProdamusConfigured()) throw new Error("Оплата картой временно не настроена");

  const amount = Math.round(Number(order.sum) || 0);
  if (amount < 30) throw new Error("Некорректная сумма (мин. 30 ₸)");

  const data: Record<string, unknown> = {
    order_id: String(order.id),
    customer_phone: String(order.phone || ""),
    customer_extra: String(order.description || "BrandWars.kz").slice(0, 240),
    products: [
      {
        name: String(order.description || "Размещение BrandWars.kz").slice(
          0,
          120,
        ),
        price: amount.toFixed(2),
        quantity: "1",
        type: "service",
      },
    ],
    do: "pay",
    currency: "kzt",
    urlReturn: order.failUrl,
    urlSuccess: order.successUrl,
    urlNotification: order.notifyUrl,
    callbackType: "json",
  };

  const sys = env("PRODAMUS_SYS");
  if (sys) data.sys = sys;
  data.signature = signProdamus(data);

  const params = new URLSearchParams();
  Object.keys(data).forEach((key) => appendQuery(params, key, data[key]));
  return `${formUrl()}?${params.toString()}`;
}

export function isProdamusPaid(payload: Record<string, unknown>): boolean {
  return String(payload.payment_status || "").toLowerCase() === "success";
}

export function prodamusOrderId(payload: Record<string, unknown>): string {
  return String(
    payload.order_id ||
      payload.order_num ||
      payload._param_order_id ||
      payload.orderId ||
      "",
  ).trim();
}

export function prodamusAmount(payload: Record<string, unknown>): number {
  return Math.round(Number(payload.sum || payload.order_sum || 0));
}

async function brokerRequest(
  action: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const brokerUrl = env("PAYMENT_BROKER_URL").replace(/\/$/, "");
  const brokerSecret = env("PAYMENT_BROKER_SECRET");
  if (!brokerUrl || !brokerSecret) {
    throw new Error("Оплата картой временно не настроена");
  }
  const response = await fetch(`${brokerUrl}/api/brandwars-payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${brokerSecret}`,
      "Content-Type": "application/json",
      ...(env("PAYMENT_BROKER_BYPASS")
        ? { "x-vercel-protection-bypass": env("PAYMENT_BROKER_BYPASS") }
        : {}),
    },
    body: JSON.stringify({ action, ...body }),
    signal: AbortSignal.timeout(25_000),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(data.error || "Не удалось создать оплату картой"));
  }
  return data;
}

export async function verifyProdamusWebhook(
  payload: Record<string, unknown>,
  signature: string,
): Promise<{
  valid: boolean;
  paid: boolean;
  orderId: string;
  amount: number;
} | null> {
  if (isProdamusConfigured()) {
    return {
      valid: verifyProdamusSignature(payload, signature),
      paid: isProdamusPaid(payload),
      orderId: prodamusOrderId(payload),
      amount: prodamusAmount(payload),
    };
  }
  if (!env("PAYMENT_BROKER_URL") || !env("PAYMENT_BROKER_SECRET")) {
    return null;
  }
  const result = await brokerRequest("verify_prodamus", { payload, signature });
  return {
    valid: Boolean(result.valid),
    paid: Boolean(result.paid),
    orderId: String(result.orderId || ""),
    amount: Number(result.amount || 0),
  };
}

export const prodamusPaymentProvider: PaymentProvider = {
  name: "prodamus",

  async createOrder(params): Promise<PaymentOrderResult> {
    const phone = normalizePhone(params.phone);
    if (!phone) throw new Error("Для оплаты укажите номер Казахстана +7");

    const amount = Math.round(params.amountKzt);
    if (amount < 30) throw new Error("Минимальная сумма — 30 ₸");

    const origin = appOrigin();
    const successUrl = `${origin}/ru/dashboard?paid=1&order=${encodeURIComponent(params.idempotencyKey)}`;
    const failUrl = `${origin}/ru/dashboard?paid=0&order=${encodeURIComponent(params.idempotencyKey)}`;
    const notifyUrl = `${origin}/api/webhooks/prodamus`;

    if (isProdamusConfigured()) {
      return {
        orderId: params.idempotencyKey,
        providerOrderId: params.idempotencyKey,
        paymentUrl: createProdamusPaymentUrl({
          id: params.idempotencyKey,
          sum: amount,
          phone,
          description: params.description,
          successUrl,
          failUrl,
          notifyUrl,
        }),
        mode: "redirect",
        status: "pending",
      };
    }

    const data = await brokerRequest("create_card", {
      orderId: params.idempotencyKey,
      amountKzt: amount,
      phone,
      name: params.name,
      email: params.email,
      description: params.description,
      ip: params.ip,
      successUrl,
      failUrl,
      notifyUrl,
    });
    const payUrl = String(data.payUrl || "");
    if (!payUrl) throw new Error("Не удалось создать оплату картой");
    return {
      orderId: params.idempotencyKey,
      providerOrderId: params.idempotencyKey,
      paymentUrl: payUrl,
      mode: "redirect",
      status: "pending",
    };
  },

  async verifyWebhook(): Promise<WebhookPayload | null> {
    return null;
  },

  async getStatus(): Promise<PaymentOrderResult["status"]> {
    return "pending";
  },
};
