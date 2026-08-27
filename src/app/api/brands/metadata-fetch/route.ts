import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchUrlMetadata } from "@/lib/metadata-fetch";

export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().url(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const metadata = await fetchUrlMetadata(parsed.data.url);
    return NextResponse.json(metadata);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 422 },
    );
  }
}
