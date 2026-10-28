import { NextRequest, NextResponse } from "next/server";
import { VerificationStatus } from "@prisma/client";
import {
  requireAdminSession,
  requireSuperAdminSession,
} from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      primaryCategory: true,
      territories: true,
      members: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
      earningsWallet: true,
      _count: { select: { cells: true, paymentOrders: true, clicks: true } },
    },
  });

  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const owner = brand.ownerUserId
    ? await prisma.user.findUnique({
        where: { id: brand.ownerUserId },
        select: { id: true, email: true, name: true, role: true },
      })
    : null;

  const recentPayments = await prisma.paymentOrder.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amountKzt: true,
      status: true,
      paymentProvider: true,
      createdAt: true,
      appliedAt: true,
    },
  });

  return NextResponse.json({ brand: { ...brand, owner }, recentPayments });
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const session = await requireSuperAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden — нужен ADMIN" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    ownerUserId?: string;
    isActive?: boolean;
    verificationStatus?: VerificationStatus;
  };

  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true },
  });
  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "verify") {
    const updated = await prisma.brand.update({
      where: { id: brand.id },
      data: { verificationStatus: "VERIFIED", isActive: true },
    });
    return NextResponse.json({ ok: true, brand: updated });
  }

  if (body.action === "reject_verification") {
    const updated = await prisma.brand.update({
      where: { id: brand.id },
      data: { verificationStatus: "REJECTED" },
    });
    return NextResponse.json({ ok: true, brand: updated });
  }

  if (body.action === "deactivate") {
    const updated = await prisma.brand.update({
      where: { id: brand.id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true, brand: updated });
  }

  if (body.action === "activate") {
    const updated = await prisma.brand.update({
      where: { id: brand.id },
      data: { isActive: true },
    });
    return NextResponse.json({ ok: true, brand: updated });
  }

  if (body.action === "transfer_owner" && body.ownerUserId) {
    const user = await prisma.user.findUnique({
      where: { id: body.ownerUserId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const updated = await prisma.brand.update({
      where: { id: brand.id },
      data: { ownerUserId: user.id },
    });
    return NextResponse.json({ ok: true, brand: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
