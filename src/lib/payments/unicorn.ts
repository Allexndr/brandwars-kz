import crypto from "crypto";
import https from "https";
import type {
  PaymentOrderResult,
  PaymentProvider,
  WebhookPayload,
} from "./provider";

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizePhone(raw?: string): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits.length === 11 && digits.startsWith("7") ? `+${digits}` : "";
}

function extract(xml: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    xml.match(new RegExp(`<input[^>]*key="${escaped}"[^>]*value="([^"]*)"`, "i"))?.[1] ??
    xml.match(new RegExp(`<input[^>]*value="([^"]*)"[^>]*key="${escaped}"`, "i"))?.[1] ??
    null
  );
}

function resultCode(xml: string): string | null {
  return xml.match(/<result[^>]*code="([^"]*)"/i)?.[1] ?? null;
}

export function isUnicornReady(): boolean {
  return Boolean(
    env("UNICORN_CERT_PEM_B64") &&
      env("UNICORN_KEY_PEM_B64") &&
      env("UNICORN_WEBHOOK_SECRET"),
  );
}

function buildRequest(params: Parameters<PaymentProvider["createOrder"]>[0]): string {
  const cert = env("UNICORN_CERT_PEM_B64");
  const key = env("UNICORN_KEY_PEM_B64");
  const webhookSecret = env("UNICORN_WEBHOOK_SECRET");
  if (!cert || !key || !webhookSecret) {
    throw new Error("Оплата картой временно не настроена");
  }

  const phone = normalizePhone(params.phone);
  if (!phone) throw new Error("Для оплаты укажите номер Казахстана +7");

  const appUrl = env("NEXTAUTH_URL", "https://brand-wars.vercel.app").replace(/\/$/, "");
  const amount = Math.max(
    1,
    Math.round(params.amountKzt) *
      (env("UNICORN_SUM_IN_TIYN", "1") === "0" ? 1 : 100),
  );
  // Secret stays in query for Unicorn notify compatibility, but fulfillment
  // below requires a real amount match — stolen secret alone is not enough.
  const notifyUrl = `${appUrl}/api/webhooks/unicorn?secret=${encodeURIComponent(webhookSecret)}`;
  const successUrl = `${appUrl}/ru/dashboard?paid=1&order=${encodeURIComponent(params.idempotencyKey)}`;
  const failUrl = `${appUrl}/ru/dashboard?paid=0&order=${encodeURIComponent(params.idempotencyKey)}`;

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<request point="${escapeXml(env("UNICORN_POINT", "4554"))}">` +
    `<advanced service="${escapeXml(env("UNICORN_SERVICE", "1330"))}" function="auth-acquiring">` +
    '<attribute name="amount_currency" value="398"/>' +
    '<attribute name="lang" value="ru"/>' +
    '<attribute name="country_code" value="KZ"/>' +
    `<attribute name="redirect_success_url" value="${escapeXml(successUrl)}"/>` +
    `<attribute name="redirect_fail_url" value="${escapeXml(failUrl)}"/>` +
    `<attribute name="notify_url" value="${escapeXml(notifyUrl)}"/>` +
    `<attribute name="id" value="${escapeXml(params.idempotencyKey)}"/>` +
    `<attribute name="desc" value="${escapeXml((params.description || "BrandWars.kz").slice(0, 120))}"/>` +
    `<attribute name="sum" value="${amount}"/>` +
    `<attribute name="email" value="${escapeXml(params.email || "pay@brandwars.kz")}"/>` +
    `<attribute name="phone_number" value="${escapeXml(phone)}"/>` +
    `<attribute name="name" value="${escapeXml(params.name || "Клиент BrandWars")}"/>` +
    `<attribute name="redirect_url" value="${escapeXml(appUrl)}"/>` +
    `<attribute name="store" value="${escapeXml(env("UNICORN_STORE", "BrandWars"))}"/>` +
    `<attribute name="ip" value="${escapeXml(params.ip || "127.0.0.1")}"/>` +
    "</advanced></request>"
  );
}

function requestUnicorn(xml: string): Promise<string> {
  const agent = new https.Agent({
    cert: Buffer.from(env("UNICORN_CERT_PEM_B64"), "base64"),
    key: Buffer.from(env("UNICORN_KEY_PEM_B64"), "base64"),
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.2",
  });

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: env("UNICORN_API_HOST", "payment.unicornlab.kz"),
        path: env("UNICORN_API_PATH", "/external/extended-cert"),
        method: "POST",
        agent,
        headers: {
          "Content-Type": "application/xml; charset=UTF-8",
          "Content-Length": Buffer.byteLength(xml),
        },
        timeout: 20_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode !== 200) {
            reject(new Error(`Unicorn HTTP ${response.statusCode ?? 0}`));
            return;
          }
          resolve(body);
        });
      },
    );
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error("Unicorn timeout")));
    request.write(xml);
    request.end();
  });
}

export const unicornPaymentProvider: PaymentProvider = {
  name: "unicorn",

  async createOrder(params): Promise<PaymentOrderResult> {
    if (!isUnicornReady()) {
      throw new Error("Оплата картой временно не настроена");
    }
    const response = await requestUnicorn(buildRequest(params));
    const payUrl = extract(response, "pay-url");
    if (resultCode(response) !== "0" || !payUrl) {
      throw new Error(`Банк отклонил создание платежа: ${resultCode(response) ?? "unknown"}`);
    }
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

export function verifyUnicornWebhookSecret(received: string): boolean {
  const expected = env("UNICORN_WEBHOOK_SECRET");
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function parseUnicornWebhook(raw: string): {
  orderId: string | null;
  paid: boolean;
  amountKzt: number | null;
} {
  const orderId =
    extract(raw, "id") ??
    raw.match(/(?:order_id|id)=([^&\s]+)/i)?.[1] ??
    raw.match(/"(?:order_id|id)"\s*:\s*"([^"]+)"/i)?.[1] ??
    null;
  // Prefer definitive Unicorn success markers; ignore bare "status":"paid"
  // and lone ACTION=0 which are too easy to forge if the secret leaks.
  const paid =
    (/state="80"/i.test(raw) && /final="1"/i.test(raw)) ||
    /pg_result=1/i.test(raw) ||
    (/RC" value="00"/i.test(raw) && /name="ACTION" value="0"/i.test(raw));
  const rawAmount =
    extract(raw, "sum") ??
    raw.match(/(?:^|[&?])sum=([\d.]+)/i)?.[1] ??
    raw.match(/"sum"\s*:\s*"?([\d.]+)/i)?.[1] ??
    null;
  const numeric = rawAmount ? Number(rawAmount) : NaN;
  const amountKzt = Number.isFinite(numeric)
    ? Math.round(numeric / (env("UNICORN_SUM_IN_TIYN", "1") === "0" ? 1 : 100))
    : null;
  return { orderId: orderId ? decodeURIComponent(orderId) : null, paid, amountKzt };
}
