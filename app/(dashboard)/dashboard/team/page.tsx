import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, invites } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { logout } from "@/app/actions/auth";
import { InviteForm } from "@/components/team/invite-form";

const roleLabels: Record<string, string> = {
  pm: "PM",
  designer: "Designer",
  developer: "Developer",
  lead: "Lead",
  admin: "Admin",
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isExpired(date: Date | string) {
  return new Date() > new Date(date);
}

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) redirect("/login");

  const members = await db.select().from(profiles).where(eq(profiles.orgId, profile.orgId));

  const pendingInvites = await db
    .select()
    .from(invites)
    .where(eq(invites.orgId, profile.orgId));

  const activePending = pendingInvites.filter((i) => !i.acceptedAt && !isExpired(i.expiresAt));
  const expired = pendingInvites.filter((i) => !i.acceptedAt && isExpired(i.expiresAt));

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">DesignQ</span>
          <span className="text-zinc-700">·</span>
          <nav className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded transition-colors"
            >
              Requests
            </Link>
            <Link
              href="/dashboard/team"
              className="text-sm text-white bg-zinc-800 px-2 py-1 rounded transition-colors"
            >
              Team
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">{profile.fullName}</span>
          <form action={logout}>
            <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* Invite section */}
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">Invite member</h2>
          <InviteForm />
          <p className="text-xs text-zinc-700 mt-2">
            Invite links are valid for 7 days. Share directly with your teammate — no email required.
          </p>
        </section>

        {/* Current members */}
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">
            Team ({members.length})
          </h2>
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between border border-zinc-800 rounded-xl px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-400">
                    {m.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-white">
                      {m.fullName}
                      {m.id === user.id && (
                        <span className="text-xs text-zinc-600 ml-1.5">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-600">{m.email}</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 capitalize">
                  {roleLabels[m.role] ?? m.role}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Pending invites */}
        {activePending.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">
              Pending invites ({activePending.length})
            </h2>
            <div className="space-y-2">
              {activePending.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between border border-zinc-800 rounded-xl px-5 py-3"
                >
                  <div>
                    <p className="text-sm text-zinc-300">{inv.email}</p>
                    <p className="text-xs text-zinc-600 capitalize">
                      {roleLabels[inv.role] ?? inv.role} · Expires {formatDate(inv.expiresAt)}
                    </p>
                  </div>
                  <span className="text-xs text-yellow-500/70">Pending</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {expired.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">
              Expired invites ({expired.length})
            </h2>
            <div className="space-y-2">
              {expired.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between border border-zinc-800/50 rounded-xl px-5 py-3 opacity-50"
                >
                  <div>
                    <p className="text-sm text-zinc-400">{inv.email}</p>
                    <p className="text-xs text-zinc-600 capitalize">
                      {roleLabels[inv.role] ?? inv.role} · Expired {formatDate(inv.expiresAt)}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600">Expired</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
