"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Return the current user's seen-hint flags.
 *
 * Used by components that need to decide whether to render a first-time
 * progressive-disclosure moment (e.g. the Prove modal). Returns an empty
 * object if unauthenticated or profile missing — callers treat every key
 * as "unseen" in that case.
 */
export async function getSeenHints(): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const [profile] = await db
    .select({ seenHints: profiles.seenHints })
    .from(profiles)
    .where(eq(profiles.id, user.id));

  return (profile?.seenHints as Record<string, boolean>) ?? {};
}
