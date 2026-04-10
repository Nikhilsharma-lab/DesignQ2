"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { stickies, profiles } from "@/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";

async function getAuthedProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id));
  return profile ?? null;
}

export async function createSticky(data: {
  content: string;
  color?: string;
  requestId?: string | null;
}) {
  const profile = await getAuthedProfile();
  if (!profile) return { error: "Not authenticated" };

  await db.insert(stickies).values({
    orgId: profile.orgId,
    authorId: profile.id,
    content: data.content,
    color: data.color ?? "cream",
    requestId: data.requestId ?? null,
  });

  revalidatePath("/dashboard/stickies");
  return { success: true };
}

export async function updateSticky(
  stickyId: string,
  data: {
    content?: string;
    color?: string;
    isPinned?: boolean;
    requestId?: string | null;
  }
) {
  const profile = await getAuthedProfile();
  if (!profile) return { error: "Not authenticated" };

  await db
    .update(stickies)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(stickies.id, stickyId), eq(stickies.authorId, profile.id))
    );

  revalidatePath("/dashboard/stickies");
  return { success: true };
}

export async function archiveSticky(stickyId: string) {
  const profile = await getAuthedProfile();
  if (!profile) return { error: "Not authenticated" };

  await db
    .update(stickies)
    .set({ archivedAt: new Date() })
    .where(
      and(eq(stickies.id, stickyId), eq(stickies.authorId, profile.id))
    );

  revalidatePath("/dashboard/stickies");
  return { success: true };
}

export async function getMyStickies() {
  const profile = await getAuthedProfile();
  if (!profile) return [];

  return db
    .select()
    .from(stickies)
    .where(
      and(eq(stickies.authorId, profile.id), isNull(stickies.archivedAt))
    )
    .orderBy(desc(stickies.isPinned), desc(stickies.createdAt));
}
