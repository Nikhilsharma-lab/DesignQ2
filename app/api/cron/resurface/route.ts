import { NextResponse } from "next/server";
import { db } from "@/db";
import { requests } from "@/db/schema";
import { lt, isNotNull, and } from "drizzle-orm";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const snoozed = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(isNotNull(requests.snoozedUntil), lt(requests.snoozedUntil, now)));

  if (snoozed.length > 0) {
    await db
      .update(requests)
      .set({ snoozedUntil: null, snoozedById: null, updatedAt: now })
      .where(and(isNotNull(requests.snoozedUntil), lt(requests.snoozedUntil, now)));
  }

  return NextResponse.json({ resurfaced: snoozed.length });
}
