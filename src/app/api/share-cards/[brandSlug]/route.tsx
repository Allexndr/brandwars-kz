import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandSlug: string }> },
) {
  const { brandSlug } = await params;

  const brand = await prisma.brand.findUnique({
    where: { slug: brandSlug },
    include: {
      primaryCategory: true,
      territories: {
        orderBy: { rank: "asc" },
        take: 1,
        include: {
          seasonCategory: { include: { season: true } },
        },
      },
    },
  });

  const territory = brand?.territories[0];
  const sharePct = territory
    ? Math.round(territory.territoryShare * 100)
    : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
          color: "white",
          padding: 48,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 28, opacity: 0.8 }}>BrandWars.kz</div>
          <div style={{ fontSize: 56, fontWeight: 700 }}>
            {brand?.name ?? brandSlug}
          </div>
          <div style={{ fontSize: 28, color: "#38bdf8" }}>
            {brand?.primaryCategory.continentRu ?? "Планета брендов"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, opacity: 0.7 }}>Место</div>
            <div style={{ fontSize: 48, fontWeight: 700 }}>
              #{territory?.rank ?? "—"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, opacity: 0.7 }}>Территория</div>
            <div style={{ fontSize: 48, fontWeight: 700 }}>{sharePct}%</div>
          </div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.75 }}>
          Лидер BrandWars в категории — игровая метрика платформы
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
