"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, organizations, invites } from "@/db/schema";
import { eq, and, ne, count } from "drizzle-orm";

// ─── Profile ────────────────────────────────────────────────────────────────

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fullName = (formData.get("fullName") as string)?.trim();
  const timezone = formData.get("timezone") as string;

  if (!fullName) return { error: "Name is required" };

  await db
    .update(profiles)
    .set({ fullName, timezone, updatedAt: new Date() })
    .where(eq(profiles.id, user.id));

  revalidatePath("/settings/account");
  return { success: true };
}

// ─── Organization ────────────────────────────────────────────────────────────

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile || profile.role !== "admin") return { error: "Admin only" };

  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim().toLowerCase();

  if (!name) return { error: "Name is required" };
  if (!slug) return { error: "Slug is required" };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Slug must be lowercase letters, numbers, and hyphens only" };
  }

  // Uniqueness check — exclude current org
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.slug, slug), ne(organizations.id, profile.orgId)));
  if (existing) return { error: "That slug is already taken" };

  await db
    .update(organizations)
    .set({ name, slug, updatedAt: new Date() })
    .where(eq(organizations.id, profile.orgId));

  revalidatePath("/settings/workspace");
  return { success: true };
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function updateMemberRole(profileId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [me] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!me || me.role !== "admin") return { error: "Admin only" };
  if (profileId === user.id) return { error: "Cannot change your own role" };

  const valid = ["pm", "designer", "developer", "lead", "admin"];
  if (!valid.includes(role)) return { error: "Invalid role" };

  await db
    .update(profiles)
    .set({ role: role as "pm" | "designer" | "developer" | "lead" | "admin", updatedAt: new Date() })
    .where(and(eq(profiles.id, profileId), eq(profiles.orgId, me.orgId)));

  revalidatePath("/settings/members");
  return { success: true };
}

export async function removeMember(profileId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [me] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!me || me.role !== "admin") return { error: "Admin only" };
  if (profileId === user.id) return { error: "Cannot remove yourself" };

  await db
    .delete(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.orgId, me.orgId)));

  revalidatePath("/settings/members");
  return { success: true };
}

export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [me] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!me || me.role !== "admin") return { error: "Admin only" };

  await db
    .delete(invites)
    .where(and(eq(invites.id, inviteId), eq(invites.orgId, me.orgId)));

  revalidatePath("/settings/members");
  return { success: true };
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────

export async function leaveOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [me] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!me) return { error: "Profile not found" };

  if (me.role === "admin") {
    const [row] = await db
      .select({ count: count() })
      .from(profiles)
      .where(and(eq(profiles.orgId, me.orgId), eq(profiles.role, "admin")));
    if (Number(row.count) <= 1) {
      return { error: "You're the only admin. Assign another admin before leaving." };
    }
  }

  await db.delete(profiles).where(eq(profiles.id, user.id));
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteOrg(confirmedSlug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [me] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!me || me.role !== "admin") return { error: "Admin only" };

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, me.orgId));
  if (!org) return { error: "Organization not found" };
  if (confirmedSlug !== org.slug) return { error: "Slug does not match. Try again." };

  await db.delete(organizations).where(eq(organizations.id, me.orgId));
  await supabase.auth.signOut();
  redirect("/login");
}
