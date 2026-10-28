import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requestWithdrawal, WITHDRAW_MIN_KZT } from "@/lib/brand-earnings";

export const dynamic = "force-dynamic";

const schema = z.object({
  brandId: z.string().min(1),
  amountKzt: z.number().int().min(WITHDRAW_MIN_KZT),
  payoutDetails: z.string().min(8).max(500),
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
      {
        error: `Проверьте сумму (от ${WITHDRAW_MIN_KZT.toLocaleString("ru-KZ")} ₸) и реквизиты`,
      },
      { status: 400 },
    );
  }

  const result = await requestWithdrawal({
    brandId: parsed.data.brandId,
    userId: session.user.id,
    amountKzt: parsed.data.amountKzt,
    payoutDetails: parsed.data.payoutDetails,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ withdrawal: result.withdrawal });
}
