import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  profiles,
  requests,
  cycles,
  cycleRequests,
  assignments,
  teams,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { CompactRequestRow } from "@/components/dashboard/request-card";

export default async function CommitmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profile (provides org scope)
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id));
  if (!profile) redirect("/login");

  // Resolve team by slug, scoped to user's org
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.slug, slug), eq(teams.orgId, profile.orgId)));
  if (!team) notFound();

  // Find the team's active cycle (most recent if multiple)
  const [activeCycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.projectId, team.id), eq(cycles.status, "active")))
    .orderBy(desc(cycles.startsAt))
    .limit(1);

  // Fetch committed requests via cycle_requests join
  let committedRequests: (typeof requests.$inferSelect)[] = [];
  const assigneeMap: Record<string, string> = {};

  if (activeCycle) {
    const rows = await db
      .select({ request: requests })
      .from(cycleRequests)
      .innerJoin(requests, eq(requests.id, cycleRequests.requestId))
      .where(eq(cycleRequests.cycleId, activeCycle.id))
      .orderBy(desc(requests.updatedAt));

    committedRequests = rows.map((r) => r.request);

    // Resolve first-assignee name per request for the card display
    if (committedRequests.length > 0) {
      const requestIds = committedRequests.map((r) => r.id);
      const allAssignments = await db
        .select({
          requestId: assignments.requestId,
          assigneeId: assignments.assigneeId,
          assignedAt: assignments.assignedAt,
        })
        .from(assignments)
        .where(inArray(assignments.requestId, requestIds))
        .orderBy(assignments.assignedAt);

      const assigneeUserIds = [
        ...new Set(allAssignments.map((a) => a.assigneeId)),
      ];

      if (assigneeUserIds.length > 0) {
        const assigneeProfiles = await db
          .select({ id: profiles.id, fullName: profiles.fullName })
          .from(profiles)
          .where(inArray(profiles.id, assigneeUserIds));

        const nameMap = Object.fromEntries(
          assigneeProfiles.map((p) => [p.id, p.fullName ?? "Unknown"])
        );

        // Map each request to its first assignment's assignee name
        // (allAssignments is ordered by assignedAt asc — first match wins)
        for (const a of allAssignments) {
          if (!assigneeMap[a.requestId]) {
            assigneeMap[a.requestId] = nameMap[a.assigneeId] ?? "Unknown";
          }
        }
      }
    }
  }

  const cycleDateRange = activeCycle ? formatCycleDates(activeCycle) : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Commitments</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {activeCycle
            ? `${activeCycle.name}${cycleDateRange ? ` · ${cycleDateRange}` : ""}`
            : "No active cycle"}
        </p>
      </div>

      {committedRequests.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center space-y-3">
          <h3 className="font-semibold text-sm text-foreground">
            What this team committed to this cycle.
          </h3>
          <div className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto text-left">
            <p>
              Active requests shows everything in progress. Commitments is
              different — it&apos;s what this team deliberately picked to run
              in the current cycle. Usually set during a planning meeting.
            </p>
            <p>
              Nothing&apos;s committed yet. When your team picks what to work
              on next, it shows up here.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          {committedRequests.map((request) => (
            <CompactRequestRow
              key={request.id}
              request={request}
              firstAssigneeName={assigneeMap[request.id] ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatCycleDates(cycle: {
  startsAt: Date | null;
  endsAt: Date | null;
}): string | null {
  if (!cycle.startsAt) return null;
  const start = new Date(cycle.startsAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (!cycle.endsAt) return start;
  const end = new Date(cycle.endsAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${start} – ${end}`;
}
