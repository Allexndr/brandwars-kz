import { NextRequest, NextResponse } from "next/server";
import { normalizeKzPhone } from "@/lib/payments/kaspi";
import {
  createKaspiPosInvoice,
  kaspiPosConfigured,
} from "@/lib/payments/kaspi-pos";

export const dynamic = "force-dynamic";

/**
 * Ops probe: which Kaspi path is alive (broker vs direct). No secrets returned.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.FOUNDERS_SEED_SECRET?.trim();
  const received = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!expected || !received || expected !== received) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
  };
  const phone = normalizeKzPhone(body.phone || "77051112240");
  const brokerUrl = process.env.PAYMENT_BROKER_URL?.trim().replace(/\/$/, "");
  const brokerSecret = process.env.PAYMENT_BROKER_SECRET?.trim();
  const hasDirectKey = Boolean(process.env.PAYPROVERKA_API_KEY?.trim());

  const result: Record<string, unknown> = {
    phone,
    hasKaspiPos: kaspiPosConfigured(),
    kaspiPosHost: process.env.KASPI_POS_URL?.trim()
      ? new URL(process.env.KASPI_POS_URL.trim()).host
      : null,
    hasBroker: Boolean(brokerUrl && brokerSecret),
    hasDirectKey,
    brokerHost: brokerUrl ? new URL(brokerUrl).host : null,
  };

  if (kaspiPosConfigured()) {
    try {
      const healthUrl = `${process.env.KASPI_POS_URL!.trim().replace(/\/$/, "")}/health`;
      const health = await fetch(healthUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      result.kaspiPosHealth = { ok: health.ok, status: health.status };
      const invoice = await createKaspiPosInvoice({
        phone,
        amount: 100,
        comment: `probe_${Date.now()}`,
      });
      result.kaspiPos = {
        ok: true,
        paymentId: Boolean(invoice.paymentId),
      };
    } catch (error) {
      result.kaspiPos = {
        ok: false,
        detail: error instanceof Error ? error.message : "kaspi-pos failed",
      };
    }
  }

  if (brokerUrl && brokerSecret) {
    try {
      const response = await fetch(`${brokerUrl}/api/brandwars-payment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${brokerSecret}`,
          "Content-Type": "application/json",
          ...(process.env.PAYMENT_BROKER_BYPASS?.trim()
            ? {
                "x-vercel-protection-bypass":
                  process.env.PAYMENT_BROKER_BYPASS.trim(),
              }
            : {}),
        },
        body: JSON.stringify({
          action: "create_kaspi",
          orderId: `probe_${Date.now()}`,
          amountKzt: 100,
          phone,
          description: "BrandWars Kaspi probe",
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = await response.json().catch(() => ({}));
      result.broker = {
        ok: response.ok,
        status: response.status,
        detail: response.ok
          ? { paymentId: Boolean((data as { paymentId?: string }).paymentId) }
          : String(
              (data as { error?: string; detail?: string }).error ||
                (data as { detail?: string }).detail ||
                "",
            ).slice(0, 200),
      };
    } catch (error) {
      result.broker = {
        ok: false,
        detail: error instanceof Error ? error.message : "broker failed",
      };
    }
  }

  if (hasDirectKey) {
    try {
      const response = await fetch(
        "https://pay.proverkacheka.kz/api/v1/invoice/create",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-API-Key": process.env.PAYPROVERKA_API_KEY!.trim(),
          },
          body: JSON.stringify({
            phoneNumber: phone,
            items: [{ name: "BrandWars probe", price: 100, count: 1 }],
          }),
          signal: AbortSignal.timeout(25_000),
        },
      );
      const raw = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw: raw.slice(0, 120) };
      }
      result.direct = {
        ok: response.ok,
        status: response.status,
        detail: response.ok
          ? { paymentId: Boolean(data.paymentId) }
          : String(data.detail || data.message || data.error || raw).slice(
              0,
              200,
            ),
      };
    } catch (error) {
      result.direct = {
        ok: false,
        detail: error instanceof Error ? error.message : "direct failed",
      };
    }
  }

  return NextResponse.json(result);
}
