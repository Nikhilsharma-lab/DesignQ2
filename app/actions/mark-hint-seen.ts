"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Mark a progressive-disclosure hint as seen for the current user.
 *
 * Uses Postgres jsonb concatenation (`||`) so multiple hints merge atomically
 * without a read-then-write race. Existing flags are preserved.
 */
export async function markHintSeen(hintKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await db
    .update(profiles)
    .set({
      seenHints: sql`COALESCE(${profiles.seenHints}, '{}'::jsonb) || jsonb_build_object(${hintKey}, true)`,
    })
    .where(eq(profiles.id, user.id));
}
