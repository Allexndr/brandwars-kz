import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  brandId: z.string().optional(),
  reason: z.enum(["FRAUD", "INAPPROPRIATE", "IMPERSONATION", "OTHER"]),
  description: z.string().min(10).max(2000),
});

export async function POST(request: NextRequest) {
  const session = await auth();

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

  if (parsed.data.brandId) {
    const brand = await prisma.brand.findUnique({
      where: { id: parsed.data.brandId },
    });
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
  }

  const report = await prisma.report.create({
    data: {
      reporterId: session?.user?.id,
      brandId: parsed.data.brandId,
      reason: parsed.data.reason,
      description: parsed.data.description,
    },
  });

  return NextResponse.json({ report }, { status: 201 });
}
