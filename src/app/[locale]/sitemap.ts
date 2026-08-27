import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = process.env.NEXTAUTH_URL ?? "https://brandwars.kz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ["ru", "kk"];
  const staticPaths = [
    "",
    "/map",
    "/brands",
    "/claim-brand",
    "/rules",
    "/privacy",
    "/terms",
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of staticPaths) {
      entries.push({
        url: `${BASE}/${locale}${path}`,
        changeFrequency: "daily",
        priority: path === "" ? 1 : 0.8,
      });
    }
  }

  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
    });
    const brands = await prisma.brand.findMany({
      where: { isActive: true, verificationStatus: "VERIFIED" },
      take: 200,
    });

    for (const locale of locales) {
      for (const cat of categories) {
        entries.push({
          url: `${BASE}/${locale}/category/${cat.slug}`,
          changeFrequency: "hourly",
          priority: 0.9,
        });
      }
      for (const brand of brands) {
        entries.push({
          url: `${BASE}/${locale}/brand/${brand.slug}`,
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
    }
  } catch {
    // DB unavailable at build time
  }

  return entries;
}
