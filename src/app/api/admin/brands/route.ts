import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const status = request.nextUrl.searchParams.get("status")?.trim() ?? "";
  const take = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("take") || 50), 1),
    200,
  );

  const brands = await prisma.brand.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
                { websiteUrl: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        status === "active"
          ? { isActive: true }
          : status === "inactive"
            ? { isActive: false }
            : status === "verified"
              ? { verificationStatus: "VERIFIED" }
              : status === "pending"
                ? { verificationStatus: "PENDING" }
                : {},
      ],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      websiteUrl: true,
      isActive: true,
      verificationStatus: true,
      createdAt: true,
      updatedAt: true,
      ownerUserId: true,
      primaryCategory: { select: { nameRu: true, slug: true, continentRu: true } },
      territories: { select: { cellCount: true, battlePower: true }, take: 1 },
      _count: { select: { paymentOrders: true, cells: true } },
    },
  });

  const ownerIds = [
    ...new Set(brands.map((b) => b.ownerUserId).filter((id): id is string => Boolean(id))),
  ];
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return NextResponse.json({
    brands: brands.map((brand) => ({
      ...brand,
      owner: brand.ownerUserId ? ownerMap.get(brand.ownerUserId) ?? null : null,
    })),
  });
}
