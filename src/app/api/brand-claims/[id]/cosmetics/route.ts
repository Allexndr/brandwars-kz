import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCOPE_CATALOG } from "@/lib/scopes";

export const dynamic = "force-dynamic";

const CHARACTER_TYPES = ["guide", "trader", "builder", "scientist", "athlete"] as const;
const CITY_SLUGS = SCOPE_CATALOG.filter((s) => s.kind === "CITY").map((s) => s.slug);

/**
 * Cosmetics live here, after the payment, instead of in front of it.
 *
 * Character, outfit and city change nothing about what a brand receives, so
 * asking for them before checkout only cost conversion. Names are constrained
 * because they are user-generated content shown publicly next to real brands —
 * free-form naming is an impersonation surface.
 */
const schema = z.object({
  representativeName: z.string().trim().min(1).max(60).optional(),
  characterType: z.enum(CHARACTER_TYPES).optional(),
  outfitColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #RRGGBB")
    .optional(),
  cityScopeSlug: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (
    parsed.data.cityScopeSlug &&
    !CITY_SLUGS.includes(parsed.data.cityScopeSlug)
  ) {
    return NextResponse.json({ error: "Неизвестный город" }, { status: 400 });
  }

  const claim = await prisma.brandClaim.findFirst({
    where: { id, submittedById: session.user.id },
    select: { id: true, metadata: true, brandName: true },
  });

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const name = parsed.data.representativeName;
  if (name) {
    // A representative must not be able to pose as a different brand from the
    // catalogue — that is exactly the impersonation the platform forbids.
    const clash = await prisma.brand.findFirst({
      where: {
        normalizedName: name.toLowerCase().replace(/[^a-zа-яё0-9]/gi, ""),
        NOT: { name: claim.brandName },
      },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Это имя занято другим брендом — выберите другое" },
        { status: 409 },
      );
    }
  }

  const existing = (claim.metadata ?? {}) as Record<string, unknown>;

  const updated = await prisma.brandClaim.update({
    where: { id: claim.id },
    data: {
      metadata: {
        ...existing,
        ...(name ? { representativeName: name } : {}),
        ...(parsed.data.characterType
          ? { characterType: parsed.data.characterType }
          : {}),
        ...(parsed.data.outfitColor
          ? { outfitColor: parsed.data.outfitColor }
          : {}),
        ...(parsed.data.cityScopeSlug
          ? { cityScopeSlug: parsed.data.cityScopeSlug }
          : {}),
      } as Prisma.InputJsonValue,
    },
    select: { id: true, metadata: true },
  });

  return NextResponse.json({ claim: updated });
}
