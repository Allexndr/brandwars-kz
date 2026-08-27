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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "BrandWarsBot/1.0 (+https://brandwars.kz)",
        Accept: "text/html",
      },
      redirect: "follow",
    });

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
