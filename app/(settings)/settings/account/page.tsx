import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AccountForm } from "@/components/settings/account-form";
import { PasswordForm } from "@/components/settings/password-form";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) redirect("/login");

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-white mb-1">Account</h1>
        <p className="text-sm text-zinc-500">Manage your personal profile settings.</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-semibold text-zinc-300">
          {profile.fullName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{profile.fullName}</p>
          <p className="text-xs text-zinc-500">{profile.email}</p>
        </div>
      </div>
      <AccountForm profile={{ fullName: profile.fullName, email: profile.email, timezone: profile.timezone ?? "UTC" }} />
      <div className="border-t border-zinc-800 pt-8">
        <h2 className="text-sm font-medium text-white mb-1">Change password</h2>
        <p className="text-xs text-zinc-500 mb-5">You are already signed in, so no current password is required.</p>
        <PasswordForm />
      </div>
    </div>
  );
}
