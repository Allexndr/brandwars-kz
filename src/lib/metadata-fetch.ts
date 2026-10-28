import { lookup } from "node:dns/promises";

export type MetadataResult = {
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
};

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function extractFavicon(html: string, baseUrl: URL): string | null {
  const iconMatch =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);

  if (iconMatch?.[1]) {
    try {
      return new URL(iconMatch[1], baseUrl).toString();
    } catch {
      return iconMatch[1];
    }
  }

  try {
    return new URL("/favicon.ico", baseUrl).toString();
  } catch {
    return null;
  }
}

function isPrivateAddress(address: string): boolean {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd")) {
    return true;
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function fetchUrlMetadata(rawUrl: string): Promise<MetadataResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new Error("Invalid URL");
  }

  try {
    const resolved = await lookup(parsed.hostname);
    if (isPrivateAddress(resolved.address)) {
      throw new Error("Blocked address");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Blocked address") throw error;
    throw new Error("Host not resolvable");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "BrandWarsBot/1.0 (+https://brandwars.kz)",
        Accept: "text/html",
      },
      // Do not follow redirects into private ranges the DNS check missed.
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error("Redirects not followed");
    }

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const html = (await response.text()).slice(0, 100_000);

    return {
      url: parsed.toString(),
      title:
        extractMeta(html, "og:title") ??
        extractMeta(html, "twitter:title") ??
        extractTitle(html),
      description:
        extractMeta(html, "og:description") ??
        extractMeta(html, "description") ??
        extractMeta(html, "twitter:description"),
      ogImage:
        extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image"),
      favicon: extractFavicon(html, parsed),
    };
  } finally {
    clearTimeout(timeout);
  }
}
