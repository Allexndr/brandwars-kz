import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkoutProviderSchema } from "@/lib/payments/methods";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { paymentStatusToken } from "@/lib/payments/status-token";
import { SUPPORT_BRAND_SHARE_BPS } from "@/lib/brand-earnings";

export const dynamic = "force-dynamic";

const schema = z.object({
  amountKzt: z.number().int().min(500).multipleOf(500),
  brandId: z.string().optional(),
  claimId: z.string().optional(),
  purpose: z.enum(["support", "top_up"]).optional(),
  provider: checkoutProviderSchema.default("prodamus"),
  phone: z.string().min(10).max(30),
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте сумму пополнения" },
      { status: 400 },
    );
  }

  let claim: { id: string; bidAmountKzt: number } | null = null;
  if (parsed.data.claimId) {
    claim = await prisma.brandClaim.findFirst({
      where: { id: parsed.data.claimId, submittedById: session.user.id },
      select: { id: true, bidAmountKzt: true },
    });
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }
    if (parsed.data.amountKzt < claim.bidAmountKzt) {
      return NextResponse.json(
        { error: "Сумма оплаты меньше суммы размещения" },
        { status: 400 },
      );
    }
  }

  let brandName: string | null = null;
  let ownsBrand = false;
  if (parsed.data.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: parsed.data.brandId },
      select: { name: true, isActive: true, ownerUserId: true },
    });
    if (!brand?.isActive) {
      return NextResponse.json({ error: "Бренд не найден" }, { status: 404 });
    }
    brandName = brand.name;
    ownsBrand = brand.ownerUserId === session.user.id;
  }

  // Owners boosting their own brand cannot use "support" (80% cashback loop).
  let purpose =
    parsed.data.purpose ??
    (parsed.data.brandId && !parsed.data.claimId && !ownsBrand
      ? "support"
      : "top_up");
  if (purpose === "support" && ownsBrand) {
    purpose = "top_up";
  }

  if (purpose === "support" && !parsed.data.brandId) {
    return NextResponse.json(
      { error: "Для поддержки укажите бренд" },
      { status: 400 },
    );
  }

  const idempotencyKey =
    parsed.data.idempotencyKey ??
    `${purpose}_${session.user.id}_${Date.now()}`;

  const existing = await prisma.paymentOrder.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (claim) {
      await prisma.brandClaim.update({
        where: { id: claim.id },
        data: { paymentOrderId: existing.id },
      });
    }
    return NextResponse.json({
      order: existing,
      paymentUrl: existing.checkoutUrl ?? undefined,
      mode: existing.paymentProvider === "kaspi" ? "kaspi_invoice" : "redirect",
      statusToken: paymentStatusToken(existing.id),
      message:
        existing.paymentProvider === "kaspi"
          ? "Счёт уже отправлен в Kaspi. Подтвердите его в приложении."
          : undefined,
      testMode: process.env.PAYMENT_TEST_MODE === "true",
      provider: existing.paymentProvider,
      purpose,
    });
  }

  const meta: Record<string, string> = {};
  if (claim) meta.claimId = claim.id;
  if (purpose === "support" || purpose === "top_up") meta.purpose = purpose;

  const brandSharePct = Math.round(SUPPORT_BRAND_SHARE_BPS / 100);
  const description = claim
    ? `Размещение ${claim.id} на BrandWars.kz`
    : purpose === "support" && brandName
      ? `Поддержка «${brandName}» · ${brandSharePct}% бренду`
      : "Пополнение BrandWars.kz";

  try {
    const provider =
      process.env.PAYMENT_TEST_MODE === "true"
        ? getPaymentProvider("test")
        : getPaymentProvider(parsed.data.provider);
    const result = await provider.createOrder({
      amountKzt: parsed.data.amountKzt,
      userId: session.user.id,
      brandId: parsed.data.brandId,
      idempotencyKey,
      metadata: Object.keys(meta).length ? meta : undefined,
      phone: parsed.data.phone,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      description,
    });

    const order = await prisma.paymentOrder.create({
      data: {
        userId: session.user.id,
        brandId: parsed.data.brandId,
        amountKzt: parsed.data.amountKzt,
        status: "PENDING",
        paymentProvider: provider.name,
        providerOrderId: result.providerOrderId,
        checkoutUrl: result.paymentUrl,
        idempotencyKey,
        metadata: (Object.keys(meta).length ? meta : undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });

    if (claim) {
      await prisma.brandClaim.update({
        where: { id: claim.id },
        data: { paymentOrderId: order.id },
      });
    }

    return NextResponse.json({
      order,
      paymentUrl: result.paymentUrl,
      mode: result.mode,
      message: result.message,
      statusToken: paymentStatusToken(order.id),
      testMode:
        provider.name === "test" || process.env.PAYMENT_TEST_MODE === "true",
      provider: provider.name,
      purpose,
      brandShareBps: purpose === "support" ? SUPPORT_BRAND_SHARE_BPS : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment create failed" },
      { status: 502 },
    );
  }
}
