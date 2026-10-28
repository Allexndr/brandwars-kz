import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateCategory } from "@/lib/territory";

export const dynamic = "force-dynamic";

const schema = z.object({
  brandId: z.string(),
  type: z.enum(["DAILY_ENERGY", "PAID_BOOST"]).default("DAILY_ENERGY"),
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const brand = await prisma.brand.findUnique({
    where: { id: parsed.data.brandId },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  if (parsed.data.type === "DAILY_ENERGY") {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const existing = await prisma.communitySupportAction.findFirst({
      where: {
        userId: session.user.id,
        brandId: brand.id,
        type: "DAILY_ENERGY",
        createdAt: { gte: since },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Daily energy already used" },
        { status: 429 },
      );
    }
  }

  const action = await prisma.communitySupportAction.create({
    data: {
      userId: session.user.id,
      brandId: brand.id,
      type: parsed.data.type,
      power: parsed.data.type === "PAID_BOOST" ? 5 : 1,
    },
  });

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
  });

  if (activeSeason) {
    const seasonCategory = await prisma.seasonCategory.findUnique({
      where: {
        seasonId_categoryId: {
          seasonId: activeSeason.id,
          categoryId: brand.primaryCategoryId,
        },
      },
    });
    if (seasonCategory) {
      await recalculateCategory(seasonCategory.id);
    }
  }

  return NextResponse.json({ action }, { status: 201 });
}
