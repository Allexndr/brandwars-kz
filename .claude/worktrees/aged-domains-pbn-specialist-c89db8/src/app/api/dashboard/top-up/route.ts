import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

const schema = z.object({
  amountKzt: z.number().int().positive(),
  brandId: z.string().optional(),
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

  const idempotencyKey =
    parsed.data.idempotencyKey ??
    `topup_${session.user.id}_${Date.now()}`;

  const existing = await prisma.paymentOrder.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return NextResponse.json({
      order: existing,
      paymentUrl: undefined,
      testMode: process.env.PAYMENT_TEST_MODE === "true",
    });
  }

  try {
    const provider = getPaymentProvider();
    const result = await provider.createOrder({
      amountKzt: parsed.data.amountKzt,
      userId: session.user.id,
      brandId: parsed.data.brandId,
      idempotencyKey,
    });

    const order = await prisma.paymentOrder.create({
      data: {
        userId: session.user.id,
        brandId: parsed.data.brandId,
        amountKzt: parsed.data.amountKzt,
        status: "PENDING",
        paymentProvider: provider.name,
        providerOrderId: result.providerOrderId,
        idempotencyKey,
      },
    });

    return NextResponse.json({
      order,
      paymentUrl: result.paymentUrl,
      testMode: provider.name === "test" || process.env.PAYMENT_TEST_MODE === "true",
      provider: provider.name,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment create failed" },
      { status: 502 },
    );
  }
}
