import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isModerator } from "@/lib/rbac";
import { slugify, normalizeBrandName } from "@/lib/utils";
import { recalculateCategory } from "@/lib/territory";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isModerator(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const moderationCase = await prisma.moderationCase.findUnique({
    where: { id },
    include: { brandClaim: { include: { paymentOrder: true } } },
  });

  if (!moderationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (parsed.data.action === "reject") {
    await prisma.$transaction([
      prisma.moderationCase.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedById: session.user.id,
          notes: parsed.data.notes,
        },
      }),
      prisma.brandClaim.update({
        where: { id: moderationCase.brandClaimId },
        data: { status: "REJECTED" },
      }),
    ]);

    return NextResponse.json({ status: "rejected" });
  }

  const claim = moderationCase.brandClaim;
  if (
    !claim.paymentOrder ||
    claim.paymentOrder.status !== "PAID" ||
    !claim.paymentOrder.appliedAt
  ) {
    return NextResponse.json(
      { error: "Нельзя одобрить заявку до подтверждённой оплаты" },
      { status: 409 },
    );
  }
  const baseSlug = slugify(claim.brandName) || "brand";
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.brand.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
  });

  const seasonCategory = activeSeason
    ? await prisma.seasonCategory.findFirst({
        where: { seasonId: activeSeason.id, categoryId: claim.categoryId },
      })
    : null;

  const brand = await prisma.brand.create({
    data: {
      slug,
      name: claim.brandName,
      normalizedName: normalizeBrandName(claim.brandName),
      websiteUrl: claim.websiteUrl,
      primaryCategoryId: claim.categoryId,
      ownerUserId: claim.submittedById,
      verificationStatus: "PENDING",
      source: "claim",
    },
  });

  await prisma.$transaction([
    prisma.brandClaim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", brandId: brand.id },
    }),
    prisma.moderationCase.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: session.user.id,
        notes: parsed.data.notes,
      },
    }),
    prisma.user.update({
      where: { id: claim.submittedById },
      data: { role: "BRAND_OWNER" },
    }),
    prisma.transaction.updateMany({
      where: { paymentOrderId: claim.paymentOrder.id },
      data: { brandId: brand.id },
    }),
  ]);

  if (seasonCategory) {
    await prisma.territory.create({
      data: {
        seasonCategoryId: seasonCategory.id,
        brandId: brand.id,
        battlePower: 0,
        territoryShare: 0,
        rank: 999,
      },
    });
    await recalculateCategory(seasonCategory.id);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "moderation_approved",
      entity: "brand",
      entityId: brand.id,
    },
  });

  return NextResponse.json({ status: "approved", brand });
}
