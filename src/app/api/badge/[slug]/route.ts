import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRankLabel } from "@/lib/territory";

export const dynamic = "force-dynamic";

/**
 * Live SVG badge a brand embeds on its own site.
 *
 * The cheapest growth loop available: the brand advertises us to its own
 * audience and gives us a backlink, while getting public proof of its position.
 * Because it updates itself, losing a place changes the badge on the brand's own
 * homepage — which is its own reason to top up.
 *
 * Served as an image so it works inside <img>, which is the only embed most
 * site owners can install without help.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rough width for a proportional font at a given size. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.58;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const theme = request.nextUrl.searchParams.get("theme") === "dark" ? "dark" : "light";

  const brand = await prisma.brand.findUnique({
    where: { slug },
    select: {
      name: true,
      isActive: true,
      primaryCategory: { select: { continentRu: true, color: true } },
      territories: {
        orderBy: { rank: "asc" },
        take: 1,
        select: { rank: true, cellCount: true },
      },
    },
  });

  const notFound = !brand || !brand.isActive || brand.territories.length === 0;

  const rank = notFound ? null : brand.territories[0].rank;
  const continent = brand?.primaryCategory.continentRu ?? "BrandWars";
  const accent = brand?.primaryCategory.color ?? "#c2410c";

  const label = notFound
    ? "BrandWars.kz"
    : `#${rank} · ${continent}`;
  const sub = notFound
    ? "занять место на карте"
    : getRankLabel(rank as number, "ru");

  const bg = theme === "dark" ? "#111827" : "#ffffff";
  const fg = theme === "dark" ? "#f8fafc" : "#0f172a";
  const muted = theme === "dark" ? "#94a3b8" : "#64748b";
  const border = theme === "dark" ? "#1f2937" : "#e2e8f0";

  const width = Math.max(
    190,
    Math.round(Math.max(textWidth(label, 13), textWidth(sub, 10)) + 58),
  );
  const height = 52;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`${brand?.name ?? "BrandWars"}: ${label}`)}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${bg}" stroke="${border}"/>
  <rect x="1" y="1" width="4" height="${height - 2}" rx="2" fill="${accent}"/>
  <g font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
    <text x="18" y="22" font-size="13" font-weight="600" fill="${fg}">${escapeXml(label)}</text>
    <text x="18" y="38" font-size="10" fill="${muted}">${escapeXml(sub)}</text>
    <text x="${width - 12}" y="38" font-size="9" fill="${muted}" text-anchor="end">brandwars.kz</text>
  </g>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Short cache: the badge losing its rank is the point.
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
