import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBrandEarningsSummary } from "@/lib/brand-earnings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany({
    where: { ownerUserId: session.user.id, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      verificationStatus: true,
      websiteUrl: true,
    },
    orderBy: { name: "asc" },
  });

  const items = await Promise.all(
    brands.map(async (brand) => ({
      brand,
      earnings: await getBrandEarningsSummary(brand.id),
    })),
  );

  return NextResponse.json({ items });
}
