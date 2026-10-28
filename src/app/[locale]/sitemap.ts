import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = process.env.NEXTAUTH_URL ?? "https://brandwars.kz";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ["ru", "kk"];
  const now = new Date();
  const staticPaths = [
    "",
    "/map",
    "/brands",
    "/claim-brand",
    // The data pages are the ones worth indexing and citing: their numbers
    // change on every request, and citation drops off sharply once a page is
    // stale, so they are declared as the freshest thing on the site.
    "/check",
    "/reports",
    "/guides",
    "/rules",
    "/privacy",
    "/terms",
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of staticPaths) {
      const isDataPage =
        path === "/reports" || path === "/guides" || path === "/check";
      entries.push({
        url: `${BASE}/${locale}${path}`,
        lastModified: now,
        changeFrequency: isDataPage ? "hourly" : "daily",
        priority: path === "" ? 1 : isDataPage ? 0.9 : 0.8,
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
          lastModified: now,
          changeFrequency: "hourly",
          priority: 0.9,
        });
      }
      for (const brand of brands) {
        entries.push({
          url: `${BASE}/${locale}/brand/${brand.slug}`,
          lastModified: brand.updatedAt,
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
