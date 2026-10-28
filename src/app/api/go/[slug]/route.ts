import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIpFrom, hashIdentifier, recordBrandClick } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * Outbound redirect for a brand link.
 *
 * Every external link on the site goes through here so the brand can be shown
 * how much traffic its position actually bought. The redirect happens even if
 * counting fails — a broken metric must never break the visitor's journey,
 * which is the whole product promise to the paying brand.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const brand = await prisma.brand.findUnique({
    where: { slug },
    select: { id: true, websiteUrl: true, isActive: true },
  });

  if (!brand?.websiteUrl) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin), 302);
  }

  let target: URL;
  try {
    target = new URL(brand.websiteUrl);
  } catch {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin), 302);
  }

  // Only ever hand the visitor to a normal web address.
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin), 302);
  }

  if (brand.isActive) {
    try {
      const ip = clientIpFrom(request.headers);
      await recordBrandClick({
        brandId: brand.id,
        ipHash: ip === "unknown" ? null : hashIdentifier(ip),
        referer: request.headers.get("referer"),
        userAgent: request.headers.get("user-agent"),
      });
    } catch (error) {
      console.error("[click-track]", error);
    }
  }

  const response = NextResponse.redirect(target.toString(), 302);
  response.headers.set("Cache-Control", "no-store");
  // Do not leak our internal URLs (which carry the brand slug) to the target.
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
