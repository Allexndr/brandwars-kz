import { NextRequest, NextResponse } from "next/server";
import { placeFounderBrands } from "@/lib/place-founders";

export const dynamic = "force-dynamic";

/**
 * One-shot placement for house brands. Auth: Bearer FOUNDERS_SEED_SECRET
 * or logged-in ADMIN via cookie is not required here so ops can run it
 * immediately after deploy.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.FOUNDERS_SEED_SECRET?.trim();
  const received = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!expected || !received || expected !== received) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await placeFounderBrands();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 },
    );
  }
}
