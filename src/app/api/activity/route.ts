import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The public chronicle: who took what, who held, what came free.
 *
 * This is the proof the planet is alive. The events were already being written
 * by the land and contest code — this only exposes them.
 */
export async function GET(request: NextRequest) {
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 20),
    50,
  );
  const categorySlug = request.nextUrl.searchParams.get("category");

  const events = await prisma.cellEvent.findMany({
    where: {
      // Internal bookkeeping is not a story worth showing.
      type: { notIn: ["UPKEEP_PAID"] },
      ...(categorySlug
        ? { arena: { seasonCategory: { category: { slug: categorySlug } } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amountKzt: true,
      createdAt: true,
      brand: {
        select: { slug: true, name: true, logoUrl: true, clickCount: true },
      },
      cell: { select: { q: true, r: true, ring: true, layer: true } },
      arena: {
        select: {
          scope: { select: { slug: true, nameRu: true, nameKk: true } },
          seasonCategory: {
            select: {
              category: {
                select: { slug: true, nameRu: true, nameKk: true, color: true },
              },
            },
          },
        },
      },
    },
  });

  const brandSlugs = events
    .map((event) => event.brand?.slug)
    .filter((slug): slug is string => Boolean(slug));

  const ranks = brandSlugs.length
    ? await prisma.territory.findMany({
        where: { brand: { slug: { in: brandSlugs } } },
        select: { rank: true, brand: { select: { slug: true } } },
      })
    : [];

  const rankBySlug = new Map(ranks.map((row) => [row.brand.slug, row.rank]));

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      amountKzt: event.amountKzt,
      createdAt: event.createdAt,
      brand: event.brand
        ? { ...event.brand, rank: rankBySlug.get(event.brand.slug) ?? null }
        : null,
      cell: event.cell,
      category: event.arena.seasonCategory.category,
      scope: event.arena.scope,
    })),
  });
}
