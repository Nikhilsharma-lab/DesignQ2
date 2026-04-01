import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, requests, assignments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const digestSchema = z.object({
  headline: z.string().describe("One punchy sentence summarising the team's week"),
  shippedThisWeek: z.string().describe(
    "What shipped this week — list each item with designer name and cycle time. If nothing shipped, say so plainly."
  ),
  teamHealth: z.string().describe(
    "Throughput (items shipped), avg cycle time, and whether the pace is improving or slipping"
  ),
  standout: z.string().describe(
    "Standout performer(s) this week — fastest output, most shipped, or highest-impact work. Name them directly."
  ),
  recommendations: z.array(z.string()).min(1).max(3).describe(
    "2-3 direct, actionable coaching recommendations — reassign work, address a bottleneck, coaching need"
  ),
});

export type WeeklyDigest = z.infer<typeof digestSchema>;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const members = await db.select().from(profiles).where(eq(profiles.orgId, profile.orgId));
  const orgRequests = await db.select().from(requests).where(eq(requests.orgId, profile.orgId));
  const orgReqIds = orgRequests.map((r) => r.id);

  const allAssignments = orgReqIds.length
    ? await db
        .select({ requestId: assignments.requestId, assigneeId: assignments.assigneeId, role: assignments.role })
        .from(assignments)
        .where(inArray(assignments.requestId, orgReqIds))
    : [];

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.fullName]));

  // Lead assignee per request (role = "lead")
  const leadByRequest: Record<string, string> = {};
  for (const a of allAssignments) {
    if (a.role === "lead") leadByRequest[a.requestId] = memberMap[a.assigneeId] ?? "Unknown";
  }

  const now = Date.now();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

  // Shipped/completed requests — for cycle time calculation
  const shippedAll = orgRequests.filter(
    (r) => r.status === "shipped" || r.status === "completed" || r.trackStage === "complete"
  );

  // This week vs last week (for throughput trend)
  const shippedThisWeek = shippedAll.filter(
    (r) => now - new Date(r.updatedAt).getTime() < ONE_WEEK_MS
  );
  const shippedLastWeek = shippedAll.filter((r) => {
    const age = now - new Date(r.updatedAt).getTime();
    return age >= ONE_WEEK_MS && age < TWO_WEEKS_MS;
  });

  const cycleDays = (r: typeof orgRequests[0]) =>
    Math.round((new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 86_400_000);

  const avgCycle = (reqs: typeof orgRequests) => {
    if (!reqs.length) return null;
    return Math.round(reqs.reduce((s, r) => s + cycleDays(r), 0) / reqs.length);
  };

  const shippedThisWeekAvgCycle = avgCycle(shippedThisWeek);
  const shippedLastWeekAvgCycle = avgCycle(shippedLastWeek);

  // Stalled: active, no update for 5+ days
  const STALL_EXEMPT = new Set(["draft", "completed", "shipped", "blocked"]);
  const stalledRequests = orgRequests.filter((r) => {
    if (STALL_EXEMPT.has(r.status)) return false;
    return (now - new Date(r.updatedAt).getTime()) / 86_400_000 >= 5;
  });

  // Active requests per designer (workload)
  const activeByDesigner: Record<string, number> = {};
  for (const a of allAssignments) {
    const req = orgRequests.find((r) => r.id === a.requestId);
    if (!req || STALL_EXEMPT.has(req.status)) continue;
    if (a.role === "lead") {
      activeByDesigner[a.assigneeId] = (activeByDesigner[a.assigneeId] ?? 0) + 1;
    }
  }

  // Shipped this week — list for prompt
  const shippedItems = shippedThisWeek.map((r) => {
    const designer = leadByRequest[r.id] ?? "Unassigned";
    const days = cycleDays(r);
    const impact = r.impactPrediction ? ` (predicted: ${r.impactPrediction})` : "";
    return `• "${r.title}" — ${designer}, ${days}d cycle time${impact}`;
  });

  // Designer workload summary
  const designerSummaries = members
    .filter((m) => m.role === "designer" || m.role === "lead")
    .map((m) => {
      const active = activeByDesigner[m.id] ?? 0;
      const shipped = shippedThisWeek.filter((r) => leadByRequest[r.id] === m.fullName).length;
      return `${m.fullName} (${m.role}): ${active} active, ${shipped} shipped this week`;
    });

  // Stalled list
  const stalledList = stalledRequests.map((r) => {
    const days = Math.floor((now - new Date(r.updatedAt).getTime()) / 86_400_000);
    const designer = leadByRequest[r.id] ?? "Unassigned";
    return `• "${r.title}" — ${designer}, stuck ${days}d`;
  });

  const throughputTrend =
    shippedLastWeekAvgCycle !== null && shippedThisWeekAvgCycle !== null
      ? shippedThisWeekAvgCycle < shippedLastWeekAvgCycle
        ? "improving (cycle time down)"
        : shippedThisWeekAvgCycle > shippedLastWeekAvgCycle
        ? "slowing (cycle time up)"
        : "steady"
      : "insufficient data for trend";

  const { object } = await generateObject({
    model: anthropic("claude-3-5-haiku-20241022"),
    schema: digestSchema,
    prompt: `You are a design ops AI writing the weekly digest for a design team lead.

TODAY: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}

SHIPPED THIS WEEK (${shippedThisWeek.length} items):
${shippedItems.length ? shippedItems.join("\n") : "Nothing shipped this week."}

SHIPPED LAST WEEK: ${shippedLastWeek.length} items

THROUGHPUT TREND: ${throughputTrend}
This week avg cycle: ${shippedThisWeekAvgCycle !== null ? `${shippedThisWeekAvgCycle} days` : "n/a"}
Last week avg cycle: ${shippedLastWeekAvgCycle !== null ? `${shippedLastWeekAvgCycle} days` : "n/a"}

DESIGNER WORKLOAD:
${designerSummaries.length ? designerSummaries.join("\n") : "No designers yet."}

STALLED (5+ days no update):
${stalledList.length ? stalledList.join("\n") : "None."}

TOTAL PIPELINE: ${orgRequests.length} requests

Write the weekly digest. Be specific — name people and requests. This is a private internal report for the design lead, not a PR document. Flag real problems plainly.`,
  });

  return NextResponse.json(object);
}
