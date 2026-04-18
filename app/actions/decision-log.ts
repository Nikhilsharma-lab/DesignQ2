"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withUserDb } from "@/db/user";
import { decisionLogEntries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

async function getAuthedUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function addDecisionLogEntry(
  requestId: string,
  data: {
    title: string;
    entryType: "chosen" | "killed";
    rationale?: string;
  },
) {
  const userId = await getAuthedUserId();
  if (!userId) return { error: "Not authenticated" };

  return withUserDb(userId, async (db) => {
    await db.insert(decisionLogEntries).values({
      requestId,
      authorId: userId,
      title: data.title,
      entryType: data.entryType,
      rationale: data.rationale ?? null,
    });

    revalidatePath(`/dashboard/requests/${requestId}`);
    return { success: true };
  });
}

export async function getDecisionLog(requestId: string) {
  const userId = await getAuthedUserId();
  if (!userId) return [];

  return withUserDb(userId, async (db) => {
    return db
      .select()
      .from(decisionLogEntries)
      .where(eq(decisionLogEntries.requestId, requestId))
      .orderBy(desc(decisionLogEntries.createdAt));
  });
}
