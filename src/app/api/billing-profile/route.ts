import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The payer's legal details, used to fill in the invoice and act.
 *
 * A company needs its registered name and БИН on the document or the accountant
 * cannot book the expense — so this is the difference between selling to
 * individuals and selling to businesses.
 */
const schema = z.object({
  kind: z.enum(["INDIVIDUAL", "COMPANY"]),
  companyName: z.string().trim().max(200).optional(),
  // БИН and ИИН are both exactly 12 digits in Kazakhstan.
  bin: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "БИН/ИИН — 12 цифр")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(300).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.billingProfile.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ profile });
}

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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // A company invoice without a name and БИН is unusable, so require both
  // rather than issuing a document that will be sent back.
  if (data.kind === "COMPANY" && (!data.companyName || !data.bin)) {
    return NextResponse.json(
      { error: "Для юрлица нужны название и БИН" },
      { status: 400 },
    );
  }

  const profile = await prisma.billingProfile.upsert({
    where: { userId: session.user.id },
    update: {
      kind: data.kind,
      companyName: data.companyName || null,
      bin: data.bin || null,
      address: data.address || null,
      contactName: data.contactName || null,
      contactPhone: data.contactPhone || null,
      email: session.user.email ?? null,
    },
    create: {
      userId: session.user.id,
      kind: data.kind,
      companyName: data.companyName || null,
      bin: data.bin || null,
      address: data.address || null,
      contactName: data.contactName || null,
      contactPhone: data.contactPhone || null,
      email: session.user.email ?? null,
    },
  });

  return NextResponse.json({ profile });
}
