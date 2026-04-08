import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { morningBriefings } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  const [existing] = await db
    .select({ id: morningBriefings.id })
    .from(morningBriefings)
    .where(
      and(
        eq(morningBriefings.userId, user.id),
        eq(morningBriefings.date, today)
      )
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No brief found" }, { status: 404 });
  }

  await db
    .update(morningBriefings)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(morningBriefings.userId, user.id),
        eq(morningBriefings.date, today)
      )
    );

  return NextResponse.json({ ok: true });
}
