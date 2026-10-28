import "server-only";

import crypto from "crypto";

const DEFAULT_TIMEOUT_MS = 25_000;

export function kaspiPosConfigured(): boolean {
  return Boolean(
    process.env.KASPI_POS_URL?.trim() &&
      process.env.KASPI_POS_TOKEN_SN?.trim() &&
      process.env.KASPI_POS_VTOKEN_SECRET?.trim(),
  );
}

function baseUrl(): string {
  return process.env.KASPI_POS_URL!.trim().replace(/\/$/, "");
}

function sessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Token-SN": process.env.KASPI_POS_TOKEN_SN!.trim(),
    "X-Vtoken-Secret": process.env.KASPI_POS_VTOKEN_SECRET!.trim(),
  };
  const profileId = process.env.KASPI_POS_PROFILE_ID?.trim();
  if (profileId) headers["X-Profile-Id"] = profileId;
  return headers;
}

async function posRequest(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      ...sessionHeaders(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    cache: "no-store",
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = String(data.error ?? data.message ?? raw.slice(0, 240));
    if (response.status === 401) {
      throw new Error(
        "Сессия Kaspi POS истекла. Перелогиньтесь в kaspi-pos-automation и обновите KASPI_POS_* в Vercel.",
      );
    }
    throw new Error(message || `Kaspi POS HTTP ${response.status}`);
  }

  if (data.error) {
    throw new Error(String(data.error));
  }

  const statusCode = data.StatusCode;
  if (statusCode !== undefined && Number(statusCode) !== 0) {
    throw new Error(
      String(data.StatusDesc ?? data.message ?? `Kaspi POS error ${statusCode}`),
    );
  }

  return data;
}

/** Normalize kaspi-pos / Kaspi Pay invoice payload for shared status helpers. */
export function normalizeKaspiPosInvoice(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const data = (raw.Data ?? raw.data ?? raw) as Record<string, unknown>;
  const status = data.Status ?? data.status ?? raw.Status ?? raw.status ?? "";
  const amount = data.Amount ?? data.amount ?? raw.Amount ?? raw.amount;
  const id = data.Id ?? data.id ?? raw.Id ?? raw.id ?? raw.paymentId;
  return {
    status: String(status),
    amount,
    paymentId: id !== undefined ? String(id) : "",
  };
}

export async function createKaspiPosInvoice(params: {
  phone: string;
  amount: number;
  comment: string;
}): Promise<Record<string, unknown>> {
  const data = await posRequest("/api/invoice/create", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: params.phone,
      amount: params.amount,
      comment: params.comment.slice(0, 120),
    }),
  });
  const normalized = normalizeKaspiPosInvoice(data);
  if (!normalized.paymentId) {
    throw new Error("Kaspi POS не вернул ID счёта");
  }
  return normalized;
}

export async function getKaspiPosInvoice(
  operationId: string,
): Promise<Record<string, unknown>> {
  const data = await posRequest(
    `/api/invoice/details?operationId=${encodeURIComponent(operationId)}`,
  );
  return normalizeKaspiPosInvoice(data);
}

export function verifyKaspiPosWebhook(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.KASPI_POS_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.startsWith("sha256=")
    ? signatureHeader
    : `sha256=${signatureHeader}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export type KaspiPosWebhookPayload = {
  event: string;
  paymentId: string;
  type: string;
  status: string;
  amount: number | null;
};

export function parseKaspiPosWebhook(body: unknown): KaspiPosWebhookPayload | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const event = String(record.event ?? "");
  const paymentId = String(record.paymentId ?? "");
  if (!event || !paymentId) return null;
  const amountRaw = record.amount;
  const amount =
    amountRaw === null || amountRaw === undefined
      ? null
      : Number.isFinite(Number(amountRaw))
        ? Math.round(Number(amountRaw))
        : null;
  return {
    event,
    paymentId,
    type: String(record.type ?? ""),
    status: String(record.status ?? ""),
    amount,
  };
}
