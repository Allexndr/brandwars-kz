import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";

export const dynamic = "force-dynamic";

/**
 * Same-origin passthrough for brand logos and favicons.
 *
 * The character studio samples a logo's pixels on a canvas to derive the
 * outfit palette, and a cross-origin image taints the canvas — so the bytes
 * have to arrive from our own origin.
 *
 * Because the URL comes from user input, this is a server-side request to an
 * arbitrary address: it is guarded against being used to reach internal
 * services (SSRF), capped in size, and restricted to image responses.
 */
const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

/** Addresses that must never be reachable through this proxy. */
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
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier NAT
  return false;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  // Resolve first and check the actual address, so a hostname pointing at an
  // internal range cannot slip through.
  try {
    const resolved = await lookup(target.hostname);
    if (isPrivateAddress(resolved.address)) {
      return NextResponse.json({ error: "Blocked address" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Host not resolvable" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      // Never follow a redirect into somewhere the checks above did not cover.
      redirect: "manual",
      headers: { Accept: "image/*" },
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ error: "Redirects not followed" }, { status: 400 });
    }
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }

    const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
