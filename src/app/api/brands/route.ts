import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const verification = searchParams.get("verification");

  const brands = await prisma.brand.findMany({
    where: {
      isActive: true,
      ...(category
        ? { primaryCategory: { slug: category } }
        : {}),
      ...(verification
        ? { verificationStatus: verification.toUpperCase() as "VERIFIED" }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      primaryCategory: true,
      territories: {
        include: { seasonCategory: { include: { season: true } } },
        orderBy: { rank: "asc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  return NextResponse.json({ brands });
}
