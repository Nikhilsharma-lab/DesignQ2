import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, requests, requestAiAnalysis, assignments } from "@/db/schema";
import { eq, inArray, count } from "drizzle-orm";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Fetch all org data for the digest
  const members = await db.select().from(profiles).where(eq(profiles.orgId, profile.orgId));
  const orgRequests = await db.select().from(requests).where(eq(requests.orgId, profile.orgId));

  const orgReqIds = orgRequests.map((r) => r.id);

  const triageRows = orgReqIds.length
    ? await db.select({ requestId: requestAiAnalysis.requestId, qualityScore: requestAiAnalysis.qualityScore })
        .from(requestAiAnalysis)
        .where(inArray(requestAiAnalysis.requestId, orgReqIds))
    : [];

  const workloadRows = orgReqIds.length
    ? await db.select({ assigneeId: assignments.assigneeId, cnt: count() })
        .from(assignments)
        .where(inArray(assignments.requestId, orgReqIds))
        .groupBy(assignments.assigneeId)
    : [];

  // Compute stalled: active requests not updated in 5+ days
  const now = Date.now();
  const STALL_EXEMPT = new Set(["draft", "completed", "shipped", "blocked"]);
  const stalledRequests = orgRequests.filter((r) => {
    if (STALL_EXEMPT.has(r.status)) return false;
    return (now - new Date(r.updatedAt).getTime()) / 86_400_000 >= 5;
  });

  // PM quality map
  const qualityByPM: Record<string, { total: number; count: number }> = {};
  for (const t of triageRows) {
    const req = orgRequests.find((r) => r.id === t.requestId);
    if (!req) continue;
    if (!qualityByPM[req.requesterId]) qualityByPM[req.requesterId] = { total: 0, count: 0 };
    qualityByPM[req.requesterId].total += t.qualityScore;
    qualityByPM[req.requesterId].count += 1;
  }

  const workloadMap = Object.fromEntries(workloadRows.map((w) => [w.assigneeId, Number(w.cnt)]));

  // Build context for Claude
  const statusCounts: Record<string, number> = {};
  for (const r of orgRequests) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;

  const pmSummaries = members
    .filter((m) => m.role === "pm" || m.role === "lead")
    .map((m) => {
      const q = qualityByPM[m.id];
      return `${m.fullName} (${m.role}): ${q ? `avg quality ${Math.round(q.total / q.count)}/100 across ${q.count} requests` : "no requests yet"}`;
    }).join("\n");

  const designerSummaries = members
    .filter((m) => m.role === "designer" || m.role === "lead")
    .map((m) => `${m.fullName}: ${workloadMap[m.id] ?? 0} active assignments`)
    .join("\n");

  const stalledList = stalledRequests
    .map((r) => {
      const daysStuck = Math.floor((now - new Date(r.updatedAt).getTime()) / 86_400_000);
      return `"${r.title}" — ${r.status}, ${daysStuck} days since update`;
    }).join("\n") || "None";

  const recentShipped = orgRequests
    .filter((r) => r.status === "shipped" || r.status === "completed")
    .slice(-5)
    .map((r) => `"${r.title}" (${r.requestType ?? "unknown"})`)
    .join("\n") || "Nothing shipped yet";

  const { object } = await generateObject({
    model: anthropic("claude-3-5-haiku-20241022"),
    schema: z.object({
      headline: z.string().describe("One punchy sentence summarizing the team's week"),
      shipped: z.string().describe("2-3 sentences on what shipped and its impact"),
      attention: z.string().describe("2-3 sentences on what needs immediate attention (stalls, overload, quality issues)"),
      teamHealth: z.string().describe("1-2 sentences on overall team health — workload balance, PM quality trends"),
      topAction: z.string().describe("The single most important thing the design lead should do today — one sentence, direct"),
    }),
    prompt: `You are a design ops AI writing the weekly digest for a design team.

TEAM SIZE: ${members.length} members

REQUEST PIPELINE:
${Object.entries(statusCounts).map(([s, c]) => `  ${s}: ${c}`).join("\n")}
Total: ${orgRequests.length}

RECENTLY SHIPPED:
${recentShipped}

STALLED (active, 5+ days no update):
${stalledList}

PM REQUEST QUALITY:
${pmSummaries || "No PM data"}

DESIGNER WORKLOAD:
${designerSummaries || "No designer data"}

Write a weekly digest. Be direct and specific — name actual requests and people where relevant. This is a private internal digest for the design lead, not a PR document. Flag real problems.`,
  });

  return NextResponse.json(object);
}
