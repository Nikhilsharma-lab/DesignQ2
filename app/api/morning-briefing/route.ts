import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { morningBriefings } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  const [brief] = await db
    .select()
    .from(morningBriefings)
    .where(
      and(
        eq(morningBriefings.userId, user.id),
        eq(morningBriefings.date, today)
      )
    )
    .limit(1);

  return NextResponse.json({ brief: brief ?? null });
}
