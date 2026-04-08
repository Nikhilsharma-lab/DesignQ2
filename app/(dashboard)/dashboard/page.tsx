import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, requests, assignments, projects, morningBriefings } from "@/db/schema";
import { eq, inArray, sql, and, isNull } from "drizzle-orm";
import { RequestList } from "@/components/requests/request-list";
import { RealtimeDashboard } from "@/components/realtime/realtime-dashboard";
import { MorningBriefingCard } from "@/components/dashboard/morning-briefing-card";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) redirect("/signup");

  const todayString = new Date().toISOString().slice(0, 10);
  const [briefRow] = await db
    .select()
    .from(morningBriefings)
    .where(
      and(
        eq(morningBriefings.userId, user.id),
        eq(morningBriefings.date, todayString)
      )
    )
    .limit(1);

  const briefForCard = briefRow && !briefRow.dismissedAt ? briefRow : null;

  const activeProjects = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, profile.orgId), isNull(projects.archivedAt)));

  const projectFilter = searchParams?.project;
  const requestsWhere = projectFilter
    ? and(eq(requests.orgId, profile.orgId), eq(requests.projectId, projectFilter))
    : eq(requests.orgId, profile.orgId);

  const allRequests = await db
    .select()
    .from(requests)
    .where(requestsWhere)
    .orderBy(
      sql`CASE priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 WHEN 'p3' THEN 3 ELSE 4 END`,
      requests.createdAt
    );

  const myAssignments = await db
    .select({ requestId: assignments.requestId })
    .from(assignments)
    .where(eq(assignments.assigneeId, user.id));

  const myRequestIds = new Set(myAssignments.map((a) => a.requestId));

  const orgReqIds = allRequests.map((r) => r.id);
  const allAssignments = orgReqIds.length
    ? await db
        .select({ requestId: assignments.requestId, assigneeId: assignments.assigneeId })
        .from(assignments)
        .where(inArray(assignments.requestId, orgReqIds))
    : [];

  const orgMembers = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.orgId, profile.orgId));

  const memberMap = Object.fromEntries(orgMembers.map((m) => [m.id, m.fullName]));

  const assigneesByRequest: Record<string, string[]> = {};
  for (const a of allAssignments) {
    if (!assigneesByRequest[a.requestId]) assigneesByRequest[a.requestId] = [];
    const name = memberMap[a.assigneeId];
    if (name) assigneesByRequest[a.requestId].push(name);
  }

  const projectMap = Object.fromEntries(
    activeProjects.map((p) => [p.id, { name: p.name, color: p.color }])
  );

  return (
    <div style={{ padding: "var(--space-6)" }}>
      <MorningBriefingCard brief={briefForCard} />
      <RealtimeDashboard orgId={profile.orgId} />
      <RequestList
        requests={allRequests}
        myRequestIds={myRequestIds}
        assigneesByRequest={assigneesByRequest}
        projects={activeProjects}
        projectMap={projectMap}
      />
    </div>
  );
}
