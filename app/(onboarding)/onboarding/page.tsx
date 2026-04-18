import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, workspaceMembers, workspaces } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { detectOnboardingVariant } from "@/lib/onboarding/detect-persona";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id));
  if (!profile) redirect("/login");

  // If already onboarded, kick back to the dashboard so users can't re-enter the flow.
  const [membership] = await db
    .select({
      onboardedAt: workspaceMembers.onboardedAt,
      invitedBy: workspaceMembers.invitedBy,
    })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, profile.orgId),
        eq(workspaceMembers.userId, user.id)
      )
    );

  if (membership?.onboardedAt) {
    redirect("/dashboard");
  }

  const [workspace] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, profile.orgId));

  // Inviter first name — used in the Designer/PM welcome copy.
  // Null when the user was not invited (workspace owners, self-joins).
  let inviterFirstName: string | null = null;
  if (membership?.invitedBy) {
    const [inviter] = await db
      .select({ fullName: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.id, membership.invitedBy));
    inviterFirstName = inviter?.fullName?.split(" ")[0] ?? null;
  }

  const variant = await detectOnboardingVariant(user.id, profile.orgId);

  const firstName = profile.fullName?.split(" ")[0] ?? "there";
  const workspaceName = workspace?.name ?? "your workspace";

  return (
    <OnboardingFlow
      variant={variant}
      userId={user.id}
      workspaceId={profile.orgId}
      firstName={firstName}
      workspaceName={workspaceName}
      inviterFirstName={inviterFirstName}
    />
  );
}
