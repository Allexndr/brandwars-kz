import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const rows = await prisma.withdrawalRequest.findMany({
    where: status
      ? { status: status as "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED" }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      brand: { select: { id: true, name: true, slug: true, verificationStatus: true } },
      requestedBy: { select: { id: true, email: true, name: true } },
      reviewedBy: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({ items: rows });
}
