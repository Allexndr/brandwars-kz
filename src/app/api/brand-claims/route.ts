import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { normalizeWebsiteUrl } from "@/lib/normalize-url";
import { formatApiError } from "@/lib/format-api-error";

export const dynamic = "force-dynamic";

const claimSchema = z.object({
  websiteUrl: z
    .string()
    .min(3)
    .transform(normalizeWebsiteUrl)
    .pipe(z.string().url()),
  brandName: z.string().min(2).max(120),
  categorySlug: z.string().min(1),
  contactEmail: z.string().email(),
  bidAmountKzt: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
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

  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatApiError(parsed.error.flatten(), "Проверьте поля заявки") },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const category = await prisma.category.findUnique({
    where: { slug: data.categorySlug },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const activeSeason = await prisma.season.findFirst({
    where: { status: "ACTIVE" },
    include: {
      seasonCategories: {
        where: { categoryId: category.id },
      },
    },
  });

  const seasonCategory = activeSeason?.seasonCategories[0];
  if (!seasonCategory) {
    return NextResponse.json({ error: "No active season for category" }, { status: 400 });
  }

  if (data.bidAmountKzt < seasonCategory.entryMinimumKzt) {
    return NextResponse.json(
      {
        error: `Minimum bid is ${seasonCategory.entryMinimumKzt} KZT`,
      },
      { status: 400 },
    );
  }

  const baseSlug = slugify(data.brandName) || "brand";
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.brand.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const claim = await prisma.brandClaim.create({
    data: {
      submittedById: session.user.id,
      websiteUrl: data.websiteUrl,
      brandName: data.brandName,
      categoryId: category.id,
      contactEmail: data.contactEmail,
      bidAmountKzt: data.bidAmountKzt,
      metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      moderation: {
        create: { status: "OPEN" },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "brand_claim_created",
      entity: "brand_claim",
      entityId: claim.id,
      metadata: { brandName: data.brandName, slug },
    },
  });

  return NextResponse.json({ claim, slugHint: slug }, { status: 201 });
}
