import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const brand = await prisma.brand.findUnique({
    where: { slug },
    include: {
      primaryCategory: true,
      territories: {
        include: {
          seasonCategory: {
            include: { season: true, category: true },
          },
        },
        orderBy: { rank: "asc" },
      },
      verifications: {
        where: { status: "VERIFIED" },
        take: 1,
      },
    },
  });

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  return NextResponse.json({ brand });
}
