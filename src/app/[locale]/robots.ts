import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /documents renders invoices with БИН, addresses and signatories —
        // personal and company data that must never reach an index.
        disallow: [
          "/ru/dashboard",
          "/kk/dashboard",
          "/ru/admin",
          "/kk/admin",
          "/ru/login",
          "/kk/login",
          "/ru/documents",
          "/kk/documents",
          "/api/",
        ],
      },
    ],
    sitemap: `${process.env.NEXTAUTH_URL ?? "https://brandwars.kz"}/ru/sitemap.xml`,
  };
}
