import type {
  PaymentOrderResult,
  PaymentProvider,
  WebhookPayload,
} from "./provider";
import { normalizeKzPhoneDigits } from "@/lib/phone";
import crypto from "crypto";
import {
  createKaspiPosInvoice,
  getKaspiPosInvoice,
  kaspiPosConfigured,
} from "./kaspi-pos";

export const PAYPROVERKA_API_URL =
  process.env.PAYPROVERKA_API_URL?.trim().replace(/\/$/, "") ||
  "https://pay.proverkacheka.kz/api";

function apiKey(): string {
  return process.env.PAYPROVERKA_API_KEY?.trim() ?? "";
}

function brokerConfigured(): boolean {
  return Boolean(
    process.env.PAYMENT_BROKER_URL?.trim() &&
      process.env.PAYMENT_BROKER_SECRET?.trim(),
  );
}

/** Same sanitization as neurokids — PayProverka rejects quotes/emojis in item names. */
export function sanitizeKaspiDescription(description: string): string {
  return description
    .replace(/[«»""''']/g, "")
    .replace(/[^\p{L}\p{N}\s\-_.:()/]/gu, "")
    .trim()
    .slice(0, 120);
}

function humanizeKaspiError(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes("no active subscription")) {
    return "Kaspi временно недоступен: нет активной подписки PayProverka. Оплатите картой или напишите нам.";
  }
  return raw.slice(0, 240) || "Kaspi API error";
}

/**
 * neurokids routes PayProverka through a local proxy when Cloudflare blocks the app server.
 * Set PAYPROVERKA_PROXY_URL=http://127.0.0.1:3002/proxy on VPS if direct fetch fails.
 */
async function payproverkaRequest(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: Record<string, unknown>; raw: string }> {
  if (!apiKey()) throw new Error("Kaspi временно не настроен");

  const url = `${PAYPROVERKA_API_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-API-Key": apiKey(),
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  const proxyUrl = process.env.PAYPROVERKA_PROXY_URL?.trim();
  let status: number;
  let raw: string;

  if (proxyUrl) {
    const proxyResponse = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        method: init?.method || "GET",
        headers,
        body: typeof init?.body === "string" ? init.body : "",
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    const proxyText = await proxyResponse.text();
    const proxyJson = JSON.parse(proxyText) as { status: number; text: string };
    status = proxyJson.status;
    raw = proxyJson.text ?? "";
  } else {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    status = response.status;
    raw = await response.text();
  }

  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = { raw: raw.slice(0, 200) };
  }

  if (status < 200 || status >= 300) {
    const detail =
      typeof data.detail === "object" && data.detail
        ? (data.detail as Record<string, unknown>).message
        : data.detail;
    throw new Error(
      humanizeKaspiError(
        String(detail || data.message || data.error || raw.slice(0, 200)),
      ),
    );
  }

  return { status, data, raw };
}

async function brokerRequest(
  action: "create_kaspi" | "kaspi_status",
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const baseUrl = process.env.PAYMENT_BROKER_URL?.trim().replace(/\/$/, "");
  const secret = process.env.PAYMENT_BROKER_SECRET?.trim();
  if (!baseUrl || !secret) return null;
  const response = await fetch(`${baseUrl}/api/brandwars-payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(process.env.PAYMENT_BROKER_BYPASS?.trim()
        ? {
            "x-vercel-protection-bypass":
              process.env.PAYMENT_BROKER_BYPASS.trim(),
          }
        : {}),
    },
    body: JSON.stringify({ action, ...body }),
    signal: AbortSignal.timeout(25_000),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      humanizeKaspiError(String(data.error || data.detail || "Payment broker error")),
    );
  }
  return data;
}

export function normalizeKzPhone(raw?: string): string {
  const digits = normalizeKzPhoneDigits(raw);
  return digits.length === 11 && digits.startsWith("7") ? digits : "";
}

export async function getKaspiInvoice(paymentId: string) {
  // 1. PayProverka direct (neurokids default)
  if (apiKey()) {
    try {
      const { data } = await payproverkaRequest(
        `/v1/invoice/${encodeURIComponent(paymentId)}`,
      );
      return data;
    } catch (error) {
      if (!brokerConfigured() && !kaspiPosConfigured()) throw error;
    }
  }

  // 2. SoulMetrica broker
  if (brokerConfigured()) {
    const broker = await brokerRequest("kaspi_status", { paymentId });
    if (broker) return broker;
  }

  // 3. Self-hosted kaspi-pos (optional)
  if (kaspiPosConfigured()) {
    return getKaspiPosInvoice(paymentId);
  }

  throw new Error("Kaspi временно не настроен");
}

export function kaspiStatus(invoice: Record<string, unknown>): string {
  return String(invoice.status ?? invoice.Status ?? "").trim().toLowerCase();
}

/** Exact statuses only — avoid matching "unpaid" via includes("paid"). */
export function kaspiIsPaid(invoice: Record<string, unknown>): boolean {
  const status = kaspiStatus(invoice);
  return (
    status === "processed" ||
    status === "paid" ||
    status === "completed" ||
    status === "delivered"
  );
}

export function kaspiIsTerminalFailure(invoice: Record<string, unknown>): boolean {
  const status = kaspiStatus(invoice);
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "expired" ||
    status.includes("failed") ||
    status.includes("rejected") ||
    status.includes("cancel") ||
    status.includes("expired")
  );
}

export function kaspiAmount(invoice: Record<string, unknown>): number | null {
  const raw = invoice.amount ?? invoice.Amount;
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  const normalized = Number(
    String(raw)
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "")
      .replace(/,/g, "."),
  );
  return Number.isFinite(normalized) ? Math.round(normalized) : null;
}

export function isKaspiReady(): boolean {
  return Boolean(apiKey()) || brokerConfigured() || kaspiPosConfigured();
}

export function verifyPayProverkaWebhook(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.PAYPROVERKA_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (expected.length !== signatureHeader.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

async function createKaspiInvoice(params: {
  phone: string;
  amount: number;
  description: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  const safeDescription = sanitizeKaspiDescription(params.description || "BrandWars.kz");
  const body = {
    phoneNumber: params.phone,
    items: [{ name: safeDescription, price: params.amount, count: 1 }],
  };

  // 1. PayProverka direct (neurokids)
  if (apiKey()) {
    try {
      const { data } = await payproverkaRequest("/v1/invoice/create", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return data;
    } catch (error) {
      if (!brokerConfigured() && !kaspiPosConfigured()) throw error;
    }
  }

  // 2. Broker
  if (brokerConfigured()) {
    try {
      const broker = await brokerRequest("create_kaspi", {
        orderId: params.idempotencyKey,
        amountKzt: params.amount,
        phone: params.phone,
        description: safeDescription,
      });
      if (broker) return broker;
    } catch (error) {
      if (!kaspiPosConfigured()) throw error;
    }
  }

  // 3. kaspi-pos fallback
  if (kaspiPosConfigured()) {
    return createKaspiPosInvoice({
      phone: params.phone,
      amount: params.amount,
      comment: `${safeDescription} · ${params.idempotencyKey}`,
    });
  }

  throw new Error("Kaspi временно не настроен");
}

export const kaspiPaymentProvider: PaymentProvider = {
  name: "kaspi",

  async createOrder(params): Promise<PaymentOrderResult> {
    const phone = normalizeKzPhone(params.phone);
    if (!phone) throw new Error("Для Kaspi укажите номер Казахстана +7");
    const amount = Math.round(params.amountKzt);
    if (amount < 30) throw new Error("Минимальная сумма Kaspi — 30 ₸");

    const description = sanitizeKaspiDescription(
      params.description || "BrandWars.kz",
    );
    const data = await createKaspiInvoice({
      phone,
      amount,
      description,
      idempotencyKey: params.idempotencyKey,
    });
    const paymentId = String(data.paymentId ?? data.PaymentId ?? "");
    if (!paymentId) throw new Error("Kaspi не вернул номер счёта");

    return {
      orderId: params.idempotencyKey,
      providerOrderId: paymentId,
      mode: "kaspi_invoice",
      message: `Счёт на ${amount.toLocaleString("ru-KZ")} ₸ отправлен в Kaspi на +${phone}`,
      status: "pending",
    };
  },

  async verifyWebhook(): Promise<WebhookPayload | null> {
    return null;
  },

  async getStatus(providerOrderId): Promise<PaymentOrderResult["status"]> {
    const invoice = await getKaspiInvoice(providerOrderId);
    if (kaspiIsPaid(invoice)) return "paid";
    if (kaspiIsTerminalFailure(invoice)) return "failed";
    return "pending";
  },
};
