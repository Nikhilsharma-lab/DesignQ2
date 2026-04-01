/**
 * Vercel Cron endpoint — auto-generates weekly digest every Friday at 9am.
 * Secured with CRON_SECRET env var (set in Vercel dashboard).
 *
 * Schedule: "0 9 * * 5" (every Friday 9:00 UTC)
 *
 * For now this is a log-only stub — digest generation is on-demand.
 * In a future sprint: generate and store digest per org so it's pre-loaded.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: iterate all orgs, generate digest, store in DB for instant load
  // For now: signal that cron fired — on-demand generation happens via /api/digest
  console.log("[cron] Weekly digest trigger fired at", new Date().toISOString());

  return NextResponse.json({ ok: true, firedAt: new Date().toISOString() });
}
