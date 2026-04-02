import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PlanDisplay } from "@/components/settings/plan-display";

export default async function PlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/settings/account");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, profile.orgId));
  if (!org) redirect("/login");

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-white mb-1">Plan</h1>
        <p className="text-sm text-zinc-500">Your current plan and included features.</p>
      </div>
      <PlanDisplay plan={org.plan} />
    </div>
  );
}
