"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { invites, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, APP_URL } from "@/lib/email";
import { inviteEmail } from "@/lib/email/templates";
import { acceptInviteMembership, getInviteContext } from "@/lib/bootstrap-access";
import { withAuthContext } from "@/lib/auth-context";

export async function createInvite(formData: FormData) {
  const result = await withAuthContext(async ({ profile, db }) => {
    const email = formData.get("email") as string;
    const role = (formData.get("role") as string) || "designer";

    if (!email) return { error: "Email is required" };

    const validRoles = ["pm", "designer", "developer", "lead", "admin"];
    if (!validRoles.includes(role)) return { error: "Invalid role" };

    if (profile.role !== "lead" && profile.role !== "admin") {
      return { error: "Only leads and admins can invite team members" };
    }

    const privilegedRoles = ["lead", "admin"];
    if (profile.role === "lead" && privilegedRoles.includes(role)) {
      return {
        error:
          "Leads can only invite designers, PMs, and developers. Contact an admin to invite leads or admins.",
      };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      await db.insert(invites).values({
        orgId: profile.orgId,
        email,
        token,
        role,
        invitedBy: profile.id,
        expiresAt,
      });
    } catch {
      return { error: "Failed to create invite" };
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, profile.orgId));
    const inviteUrl = `${APP_URL}/invite/${token}`;

    sendEmail({
      to: email,
      subject: `You've been invited to ${org?.name ?? "Lane"}`,
      html: inviteEmail({
        invitedByName: profile.fullName ?? "Your team lead",
        orgName: org?.name ?? "Lane",
        role,
        inviteUrl,
      }),
    });

    return { success: true, token };
  });

  if (result && typeof result === "object" && "status" in result) {
    return { error: result.error };
  }

  return result;
}

export async function acceptInvite(token: string, formData: FormData) {
  const invite = await getInviteContext(token);
  if (!invite) return { error: "Invalid invite link" };
  if (invite.acceptedAt) return { error: "This invite has already been used" };
  if (new Date() > invite.expiresAt) {
    return { error: "This invite has expired. Ask your team lead to send a new one." };
  }

  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  // Ensure the submitted email matches the invited email
  if (email.toLowerCase().trim() !== invite.email.toLowerCase().trim()) {
    return { error: "This invite was sent to a different email address" };
  }

  // Sign up or sign in
  const { data, error } = await supabase.auth.signUp({ email, password });
  let userId: string;

  if (error) {
    if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already been registered")) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) return { error: "Account exists — wrong password. Try signing in first." };
      if (!signInData.user) return { error: "Could not sign in" };
      userId = signInData.user.id;
    } else {
      return { error: error.message };
    }
  } else {
    if (!data.user) return { error: "Signup failed" };
    if (data.user.identities?.length === 0) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) return { error: "Account exists. Try your existing password." };
      if (!signInData.user) return { error: "Could not sign in" };
      userId = signInData.user.id;
    } else {
      userId = data.user.id;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) return { error: "Account created but could not sign in. Try signing in manually." };
    }
  }

  try {
    await acceptInviteMembership({
      token,
      userId,
      fullName,
      email,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg || "Failed to accept invite" };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
