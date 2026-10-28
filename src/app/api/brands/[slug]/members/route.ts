import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Seats on a brand.
 *
 * Only the owner or the approved claimant may change the roster — a manager
 * cannot add further managers, which keeps an agency employee from quietly
 * widening access to a client's brand.
 */
const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER"]).default("MANAGER"),
});

async function loadBrandForAdmin(slug: string, userId: string) {
  const brand = await prisma.brand.findUnique({
    where: { slug },
    select: {
      id: true,
      ownerUserId: true,
      claims: {
        where: { submittedById: userId, status: "APPROVED" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!brand) return { brand: null, canAdmin: false };

  const canAdmin =
    brand.ownerUserId === userId || brand.claims.length > 0;

  return { brand, canAdmin };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const { brand, canAdmin } = await loadBrandForAdmin(slug, session.user.id);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  // A member may see the roster; only an admin may change it.
  const isMember = await prisma.brandMember.findFirst({
    where: { brandId: brand.id, userId: session.user.id },
    select: { id: true },
  });
  if (!canAdmin && !isMember) {
    return NextResponse.json({ error: "Нет прав на этот бренд" }, { status: 403 });
  }

  const members = await prisma.brandMember.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  return NextResponse.json({ canAdmin, members });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const { brand, canAdmin } = await loadBrandForAdmin(slug, session.user.id);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  if (!canAdmin) {
    return NextResponse.json(
      { error: "Только владелец бренда может добавлять доступы" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  // The invitee has no session until they sign in with this address, so
  // creating the record cannot be used to take over an inbox.
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
    select: { id: true },
  });

  if (user.id === brand.ownerUserId) {
    return NextResponse.json(
      { error: "Это владелец бренда — доступ у него уже есть" },
      { status: 409 },
    );
  }

  const member = await prisma.brandMember.upsert({
    where: { brandId_userId: { brandId: brand.id, userId: user.id } },
    update: { role: parsed.data.role },
    create: {
      brandId: brand.id,
      userId: user.id,
      role: parsed.data.role,
      invitedByUserId: session.user.id,
    },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const memberId = request.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  }

  const { brand, canAdmin } = await loadBrandForAdmin(slug, session.user.id);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const member = await prisma.brandMember.findUnique({
    where: { id: memberId },
    select: { id: true, brandId: true, userId: true },
  });
  if (!member || member.brandId !== brand.id) {
    return NextResponse.json({ error: "Доступ не найден" }, { status: 404 });
  }

  // An admin may remove anyone; a member may only remove themselves.
  if (!canAdmin && member.userId !== session.user.id) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  await prisma.brandMember.delete({ where: { id: member.id } });
  return NextResponse.json({ removed: true });
}
