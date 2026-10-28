import "server-only";

import { prisma } from "@/lib/prisma";

export type BrandAccessResult =
  | { ok: true; brandId: string; primaryCategoryId: string }
  | { ok: false; error: string; status: number };

/**
 * A user may act for a brand if they own it, submitted its approved claim, or
 * hold a seat on it.
 *
 * The seat case is what makes agencies workable: they buy for many clients and
 * cannot hand one login around the office. Land actions spend real money and
 * change a public map, so this is checked on every one of them rather than
 * trusted from the client.
 */
export async function assertBrandAccess(
  userId: string,
  brandId: string,
): Promise<BrandAccessResult> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      ownerUserId: true,
      isActive: true,
      verificationStatus: true,
      primaryCategoryId: true,
      claims: {
        where: { submittedById: userId, status: "APPROVED" },
        select: { id: true },
        take: 1,
      },
      members: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!brand) return { ok: false, error: "Brand not found", status: 404 };
  if (!brand.isActive) {
    return { ok: false, error: "Бренд неактивен", status: 409 };
  }

  const isOwner = brand.ownerUserId === userId;
  const hasApprovedClaim = brand.claims.length > 0;
  const hasSeat = brand.members.length > 0;

  if (!isOwner && !hasApprovedClaim && !hasSeat) {
    return { ok: false, error: "Нет прав на этот бренд", status: 403 };
  }

  if (brand.verificationStatus === "REJECTED") {
    return { ok: false, error: "Заявка бренда отклонена", status: 403 };
  }

  return {
    ok: true,
    brandId: brand.id,
    primaryCategoryId: brand.primaryCategoryId,
  };
}
