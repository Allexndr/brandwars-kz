import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Brands the signed-in user can manage, with the claim that carries their
 * cosmetics.
 *
 * Cosmetics live on the claim's metadata, so the dashboard needs the claim id
 * to save them — the character is configured here, after payment, rather than
 * in front of it.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Brands reachable through a seat, not just through one's own claims —
  // otherwise an agency employee opens the dashboard and sees nothing.
  const seatBrandIds = (
    await prisma.brandMember.findMany({
      where: { userId: session.user.id },
      select: { brandId: true },
    })
  ).map((m) => m.brandId);

  const claims = await prisma.brandClaim.findMany({
    where: {
      OR: [
        { submittedById: session.user.id },
        ...(seatBrandIds.length ? [{ brandId: { in: seatBrandIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      brandName: true,
      status: true,
      metadata: true,
      websiteUrl: true,
      brand: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          clickCount: true,
          primaryCategory: { select: { slug: true, nameRu: true, continentRu: true } },
          territories: {
            orderBy: { rank: "asc" },
            take: 1,
            select: { rank: true, cellCount: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    brands: claims.map((claim) => {
      const meta = (claim.metadata ?? {}) as Record<string, unknown>;
      return {
        claimId: claim.id,
        claimStatus: claim.status,
        name: claim.brand?.name ?? claim.brandName,
        slug: claim.brand?.slug ?? null,
        brandId: claim.brand?.id ?? null,
        categorySlug: claim.brand?.primaryCategory.slug ?? null,
        continent: claim.brand?.primaryCategory.continentRu ?? null,
        rank: claim.brand?.territories[0]?.rank ?? null,
        cellCount: claim.brand?.territories[0]?.cellCount ?? 0,
        clickCount: claim.brand?.clickCount ?? 0,
        logoUrl:
          claim.brand?.logoUrl ??
          (typeof meta.favicon === "string" ? meta.favicon : null),
        cosmetics: {
          representativeName:
            typeof meta.representativeName === "string"
              ? meta.representativeName
              : null,
          characterType:
            typeof meta.characterType === "string" ? meta.characterType : null,
          outfitColor:
            typeof meta.outfitColor === "string" ? meta.outfitColor : null,
          costume: meta.costume ?? null,
        },
      };
    }),
  });
}
