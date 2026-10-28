import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getKaspiInvoice,
  kaspiAmount,
  kaspiIsPaid,
  kaspiIsTerminalFailure,
  kaspiStatus,
  normalizeKzPhone,
} from "@/lib/payments/kaspi";
import { fulfillPaidOrder } from "@/lib/payment-fulfillment";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.FOUNDERS_SEED_SECRET?.trim();
  const received = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  return Boolean(expected && received && expected === received);
}

/**
 * Ops: create test invoice + list/reconcile recent Kaspi orders.
 * Auth: Bearer FOUNDERS_SEED_SECRET
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "probe" | "list" | "reconcile";
    phone?: string;
    amountKzt?: number;
    limit?: number;
  };
  const action = body.action || "probe";

  if (action === "probe") {
    const phone = normalizeKzPhone(body.phone || "77051112240");
    const amount = Math.max(100, Math.round(body.amountKzt || 100));
    const hasDirectKey = Boolean(process.env.PAYPROVERKA_API_KEY?.trim());
    const brokerUrl = process.env.PAYMENT_BROKER_URL?.trim().replace(/\/$/, "");
    const brokerSecret = process.env.PAYMENT_BROKER_SECRET?.trim();
    const result: Record<string, unknown> = {
      phone,
      amount,
      hasDirectKey,
      hasBroker: Boolean(brokerUrl && brokerSecret),
      brokerHost: brokerUrl ? new URL(brokerUrl).host : null,
      payproverkaUrl: (process.env.PAYPROVERKA_API_URL || "https://pay.proverkacheka.kz/api").replace(
        /\/$/,
        "",
      ),
    };

    if (hasDirectKey) {
      try {
        const response = await fetch(
          `${String(result.payproverkaUrl)}/v1/invoice/create`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-API-Key": process.env.PAYPROVERKA_API_KEY!.trim(),
            },
            body: JSON.stringify({
              phoneNumber: phone,
              items: [{ name: "BrandWars probe", price: amount, count: 1 }],
            }),
            signal: AbortSignal.timeout(25_000),
          },
        );
        const raw = await response.text();
        let data: Record<string, unknown> = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { raw: raw.slice(0, 160) };
        }
        result.direct = {
          ok: response.ok,
          status: response.status,
          detail: response.ok
            ? { paymentId: data.paymentId ?? null }
            : String(
                typeof data.detail === "object" && data.detail
                  ? (data.detail as Record<string, unknown>).message
                  : data.detail || data.message || data.error || raw,
              ).slice(0, 300),
        };
      } catch (error) {
        result.direct = {
          ok: false,
          detail: error instanceof Error ? error.message : "direct failed",
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
            amountKzt: amount,
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
            ? {
                paymentId: (data as { paymentId?: string }).paymentId ?? null,
              }
            : String(
                (data as { error?: string }).error ||
                  (data as { detail?: string }).detail ||
                  "",
              ).slice(0, 300),
        };
      } catch (error) {
        result.broker = {
          ok: false,
          detail: error instanceof Error ? error.message : "broker failed",
        };
      }
    }

    return NextResponse.json(result);
  }

  if (action === "list" || action === "reconcile") {
    const limit = Math.min(Math.max(body.limit || 30, 1), 100);
    const orders = await prisma.paymentOrder.findMany({
      where: { paymentProvider: "kaspi" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { email: true, name: true } },
        brandClaim: { select: { brandName: true, websiteUrl: true, status: true } },
        transaction: { select: { id: true, status: true, type: true } },
      },
    });

    const rows = [];
    for (const order of orders) {
      let remote: Record<string, unknown> | null = null;
      let remoteError: string | null = null;
      if (order.providerOrderId) {
        try {
          remote = await getKaspiInvoice(order.providerOrderId);
        } catch (error) {
          remoteError =
            error instanceof Error ? error.message : "invoice fetch failed";
        }
      }

      const remoteStatus = remote ? kaspiStatus(remote) : null;
      const remotePaid = remote ? kaspiIsPaid(remote) : false;
      const remoteAmount = remote ? kaspiAmount(remote) : null;
      let reconciled: string | null = null;

      if (
        action === "reconcile" &&
        remotePaid &&
        order.status !== "PAID" &&
        remoteAmount === order.amountKzt
      ) {
        const fulfilled = await fulfillPaidOrder(
          order.id,
          order.providerOrderId!,
          remoteAmount,
        );
        reconciled = fulfilled ? "fulfilled" : "fulfill_failed";
      } else if (
        action === "reconcile" &&
        remote &&
        kaspiIsTerminalFailure(remote) &&
        order.status === "PENDING"
      ) {
        await prisma.paymentOrder.update({
          where: { id: order.id },
          data: { status: "FAILED" },
        });
        reconciled = "marked_failed";
      }

      rows.push({
        id: order.id,
        amountKzt: order.amountKzt,
        status: order.status,
        appliedAt: order.appliedAt,
        providerOrderId: order.providerOrderId,
        createdAt: order.createdAt,
        email: order.user.email,
        claim: order.brandClaim?.brandName ?? null,
        website: order.brandClaim?.websiteUrl ?? null,
        claimStatus: order.brandClaim?.status ?? null,
        hasTransaction: Boolean(order.transaction),
        remoteStatus,
        remotePaid,
        remoteAmount,
        remoteError,
        reconciled,
      });
    }

    return NextResponse.json({
      action,
      count: rows.length,
      paidLocal: rows.filter((r) => r.status === "PAID").length,
      pendingLocal: rows.filter((r) => r.status === "PENDING").length,
      remotePaidPendingLocal: rows.filter(
        (r) => r.remotePaid && r.status !== "PAID",
      ).length,
      rows,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
