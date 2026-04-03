import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, requests, assignments, projects } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { DevBoard } from "@/components/dev-board/dev-board";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { UserMenu } from "@/components/settings/user-menu";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { HeaderSearch } from "@/components/ui/header-search";
import { KANBAN_STATES, type KanbanState, type CardData } from "@/components/dev-board/types";

export default async function DevBoardPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
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

  const activeProjects = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, profile.orgId), isNull(projects.archivedAt)));

  const projectFilter = searchParams?.project;

  const whereClause = projectFilter
    ? and(
        eq(requests.orgId, profile.orgId),
        eq(requests.phase, "dev"),
        eq(requests.projectId, projectFilter)
      )
    : and(eq(requests.orgId, profile.orgId), eq(requests.phase, "dev"));

  const devRequests = await db.select().from(requests).where(whereClause);

  // Fetch assignee names
  const reqIds = devRequests.map((r) => r.id);
  const allAssignments = reqIds.length
    ? await db
        .select({
          requestId: assignments.requestId,
          assigneeId: assignments.assigneeId,
        })
        .from(assignments)
        .where(inArray(assignments.requestId, reqIds))
    : [];

  const orgMembers = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.orgId, profile.orgId));

  const memberMap = Object.fromEntries(
    orgMembers.map((m) => [m.id, m.fullName ?? ""])
  );

  const assigneesByRequest: Record<string, string[]> = {};
  for (const a of allAssignments) {
    if (!assigneesByRequest[a.requestId]) assigneesByRequest[a.requestId] = [];
    const name = memberMap[a.assigneeId];
    if (name) assigneesByRequest[a.requestId].push(name);
  }

  const projectMap = Object.fromEntries(
    activeProjects.map((p) => [p.id, { name: p.name, color: p.color }])
  );

  // Group by kanban_state
  const columns = Object.fromEntries(
    KANBAN_STATES.map((s) => [s, [] as CardData[]])
  ) as Record<KanbanState, CardData[]>;

  for (const r of devRequests) {
    const state = (r.kanbanState ?? "todo") as KanbanState;
    const proj = r.projectId ? projectMap[r.projectId] : null;
    columns[state].push({
      id: r.id,
      title: r.title,
      description: r.description,
      businessContext: r.businessContext ?? null,
      priority: r.priority ?? null,
      requestType: r.requestType ?? null,
      kanbanState: state,
      projectId: r.projectId ?? null,
      projectName: proj?.name ?? null,
      projectColor: proj?.color ?? null,
      assignees: assigneesByRequest[r.id] ?? [],
      deadlineAt: r.deadlineAt ? r.deadlineAt.toISOString() : null,
      figmaUrl: r.figmaUrl ?? null,
      figmaLockedAt: r.figmaLockedAt ? r.figmaLockedAt.toISOString() : null,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
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
              className="text-sm text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded transition-colors"
            >
              Team
            </Link>
            <Link
              href="/dashboard/insights"
              className="text-sm text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded transition-colors"
            >
              Insights
            </Link>
            <Link
              href="/dashboard/ideas"
              className="text-sm text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded transition-colors"
            >
              Ideas
            </Link>
            <Link
              href="/dashboard/radar"
              className="text-sm text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded transition-colors"
            >
              Radar
            </Link>
            <Link
              href="/dashboard/dev"
              className="text-sm text-white bg-zinc-800 px-2 py-1 rounded transition-colors"
            >
              Dev Board
            </Link>
          </nav>
          <ProjectSwitcher projects={activeProjects} />
        </div>
        <div className="flex items-center gap-3">
          <HeaderSearch />
          <NotificationsBell />
          <span className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 capitalize">
            {profile.role}
          </span>
          <UserMenu fullName={profile.fullName} />
        </div>
      </header>

      {/* Board — full height, horizontal scroll */}
      <main className="flex-1 px-6 py-6 overflow-hidden">
        <DevBoard columns={columns} orgId={profile.orgId} />
      </main>
    </div>
  );
}
