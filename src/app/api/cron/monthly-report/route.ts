import { NextRequest, NextResponse } from "next/server";
import { sendMonthlyReports } from "@/lib/monthly-report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Sends the monthly performance email.
 *
 * Scheduled daily but only meaningful once a month per brand — the guard is the
 * `?day=` check below, so a daily cron on a Hobby plan still produces a monthly
 * cadence without a second schedule.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  const dayOfMonth = new Date().getUTCDate();

  // Run on the 1st only, so a daily schedule yields a monthly email.
  if (!force && dayOfMonth !== 1) {
    return NextResponse.json({
      skipped: true,
      reason: `runs on the 1st; today is the ${dayOfMonth}`,
    });
  }

  const result = await sendMonthlyReports();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
