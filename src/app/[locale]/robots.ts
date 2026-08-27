import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/ru/dashboard", "/kk/dashboard", "/ru/admin", "/kk/admin", "/ru/login", "/kk/login"],
      },
    ],
    sitemap: `${process.env.NEXTAUTH_URL ?? "https://brandwars.kz"}/ru/sitemap.xml`,
  };
}
