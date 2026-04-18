// lib/ai/morning-briefing.ts
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { db } from "@/db";
import {
  requests,
  comments,
  proactiveAlerts,
  figmaUpdates,
  validationSignoffs,
  ideas,
  ideaVotes,
  iterations,
  decisionLogEntries,
  impactRecords,
} from "@/db/schema";
import { and, eq, ne, gte, inArray, desc, sql, gt } from "drizzle-orm";
import type { MorningBriefContent } from "@/db/schema/morning_briefings";

const briefSchema = z.object({
  greeting: z.string().describe("Personalized greeting, e.g. 'Good morning, Yash'"),
  items: z
    .array(
      z.object({
        icon: z.string().describe("Single emoji: ✅ 💬 🔴 💡 ⏳ 🚀"),
        text: z.string().describe("One specific, conversational sentence"),
        href: z.string().optional().describe("Link to the relevant request, e.g. /dashboard/requests/{id}. Only include when referencing a specific request from the context."),
      })
    )
    .describe("Array of 1 to 5 briefing items, in priority order with the most important first."),
  oneThing: z
    .string()
    .describe("Single concrete action the user can take in the next hour. Start with 'Today:'"),
  oneThingHref: z
    .string()
    .optional()
    .describe("Link to the request the oneThing action refers to, e.g. /dashboard/requests/{id}. Only include when the action is about a specific request."),
});

async function gatherDesignerContext(userId: string, orgId: string) {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);

  const activeRequests = await db
    .select({
      id: requests.id,
      title: requests.title,
      phase: requests.phase,
      designStage: requests.designStage,
      updatedAt: requests.updatedAt,
      sensingSummary: requests.sensingSummary,
      designFrameProblem: requests.designFrameProblem,
      engineeringFeasibility: requests.engineeringFeasibility,
    })
    .from(requests)
    .where(
      and(
        eq(requests.orgId, orgId),
        eq(requests.designerOwnerId, userId),
        inArray(requests.phase, ["design", "dev"])
      )
    );

  const reqIds = activeRequests.map((r) => r.id);

  const overnightComments = reqIds.length
    ? await db
        .select({
          requestId: comments.requestId,
          body: comments.body,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .where(
          and(
            inArray(comments.requestId, reqIds),
            gte(comments.createdAt, midnight),
            ne(comments.authorId, userId)
          )
        )
    : [];

  const proveReqIds = activeRequests
    .filter((r) => r.designStage === "prove")
    .map((r) => r.id);

  const mySignoffs = proveReqIds.length
    ? await db
        .select({ requestId: validationSignoffs.requestId })
        .from(validationSignoffs)
        .where(
          and(
            inArray(validationSignoffs.requestId, proveReqIds),
            eq(validationSignoffs.signerId, userId)
          )
        )
    : [];

  const signedIds = new Set(mySignoffs.map((s) => s.requestId));
  const pendingSignoffs = proveReqIds
    .filter((id) => !signedIds.has(id))
    .map((id) => activeRequests.find((r) => r.id === id)!);

  const alerts = await db
    .select({ type: proactiveAlerts.type, title: proactiveAlerts.title, body: proactiveAlerts.body })
    .from(proactiveAlerts)
    .where(
      and(
        eq(proactiveAlerts.recipientId, userId),
        eq(proactiveAlerts.dismissed, false),
        gt(proactiveAlerts.expiresAt, new Date())
      )
    );

  const figmaDrifts = reqIds.length
    ? await db
        .select({ id: figmaUpdates.id, requestId: figmaUpdates.requestId })
        .from(figmaUpdates)
        .where(
          and(
            inArray(figmaUpdates.requestId, reqIds),
            eq(figmaUpdates.postHandoff, true),
            eq(figmaUpdates.devReviewed, false)
          )
        )
    : [];

  // Item 14 progress signals — surface iteration and decision-log activity
  // so the briefing reflects the design journey, not just stage labels.
  const iterationCounts = reqIds.length
    ? await db
        .select({
          requestId: iterations.requestId,
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(iterations)
        .where(inArray(iterations.requestId, reqIds))
        .groupBy(iterations.requestId)
    : [];

  const decisionCounts = reqIds.length
    ? await db
        .select({
          requestId: decisionLogEntries.requestId,
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(decisionLogEntries)
        .where(inArray(decisionLogEntries.requestId, reqIds))
        .groupBy(decisionLogEntries.requestId)
    : [];

  const iterationCountByReq = new Map(iterationCounts.map((r) => [r.requestId, r.count]));
  const decisionCountByReq = new Map(decisionCounts.map((r) => [r.requestId, r.count]));

  return {
    activeRequests,
    overnightComments,
    pendingSignoffs,
    alerts,
    figmaDrifts,
    iterationCountByReq,
    decisionCountByReq,
  };
}

async function gatherDeveloperContext(userId: string, orgId: string) {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);

  const activeRequests = await db
    .select({
      id: requests.id,
      title: requests.title,
      phase: requests.phase,
      kanbanState: requests.kanbanState,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .where(
      and(
        eq(requests.orgId, orgId),
        eq(requests.devOwnerId, userId),
        eq(requests.phase, "dev")
      )
    );

  const reqIds = activeRequests.map((r) => r.id);

  const overnightComments = reqIds.length
    ? await db
        .select({
          requestId: comments.requestId,
          body: comments.body,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .where(
          and(
            inArray(comments.requestId, reqIds),
            gte(comments.createdAt, midnight),
            ne(comments.authorId, userId)
          )
        )
    : [];

  const alerts = await db
    .select({ type: proactiveAlerts.type, title: proactiveAlerts.title, body: proactiveAlerts.body })
    .from(proactiveAlerts)
    .where(
      and(
        eq(proactiveAlerts.recipientId, userId),
        eq(proactiveAlerts.dismissed, false),
        gt(proactiveAlerts.expiresAt, new Date())
      )
    );

  const figmaDrifts = reqIds.length
    ? await db
        .select({ id: figmaUpdates.id, requestId: figmaUpdates.requestId })
        .from(figmaUpdates)
        .where(
          and(
            inArray(figmaUpdates.requestId, reqIds),
            eq(figmaUpdates.postHandoff, true),
            eq(figmaUpdates.devReviewed, false)
          )
        )
    : [];

  const kanbanCounts = {
    todo: activeRequests.filter((r) => r.kanbanState === "todo").length,
    in_progress: activeRequests.filter((r) => r.kanbanState === "in_progress").length,
    in_review: activeRequests.filter((r) => r.kanbanState === "in_review").length,
    qa: activeRequests.filter((r) => r.kanbanState === "qa").length,
    done: activeRequests.filter((r) => r.kanbanState === "done").length,
  };

  return { activeRequests, overnightComments, alerts, figmaDrifts, kanbanCounts };
}

async function gatherPmContext(userId: string, orgId: string) {
  const myRequests = await db
    .select({
      id: requests.id,
      title: requests.title,
      status: requests.status,
      phase: requests.phase,
      designStage: requests.designStage,
      impactActual: requests.impactActual,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .where(and(eq(requests.orgId, orgId), eq(requests.requesterId, userId)))
    .orderBy(desc(requests.updatedAt))
    .limit(20);

  const proveReqIds = myRequests
    .filter((r) => r.designStage === "prove")
    .map((r) => r.id);

  const pmSignoffs = proveReqIds.length
    ? await db
        .select({ requestId: validationSignoffs.requestId })
        .from(validationSignoffs)
        .where(
          and(
            inArray(validationSignoffs.requestId, proveReqIds),
            eq(validationSignoffs.signerId, userId),
            eq(validationSignoffs.signerRole, "pm")
          )
        )
    : [];

  const signedIds = new Set(pmSignoffs.map((s) => s.requestId));
  const pendingSignoffs = proveReqIds
    .filter((id) => !signedIds.has(id))
    .map((id) => myRequests.find((r) => r.id === id)!);

  const needsImpact = myRequests.filter(
    (r) => r.phase === "track" && !r.impactActual
  );

  // PM calibration signals — predicted vs actual from impact_records.
  // Framed as learning loop, not performance scoring.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCalibrations = await db
    .select({
      requestTitle: requests.title,
      predictedMetric: impactRecords.predictedMetric,
      predictedValue: impactRecords.predictedValue,
      actualValue: impactRecords.actualValue,
      variancePercent: impactRecords.variancePercent,
      measuredAt: impactRecords.measuredAt,
    })
    .from(impactRecords)
    .innerJoin(requests, eq(impactRecords.requestId, requests.id))
    .where(
      and(
        eq(impactRecords.pmId, userId),
        gte(impactRecords.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(impactRecords.createdAt))
    .limit(3);

  const alerts = await db
    .select({ type: proactiveAlerts.type, title: proactiveAlerts.title, body: proactiveAlerts.body })
    .from(proactiveAlerts)
    .where(
      and(
        eq(proactiveAlerts.recipientId, userId),
        eq(proactiveAlerts.dismissed, false),
        gt(proactiveAlerts.expiresAt, new Date())
      )
    );

  return { myRequests, pendingSignoffs, needsImpact, alerts, recentCalibrations };
}

async function gatherLeadContext(orgId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setUTCHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);

  const allOrgRequests = await db
    .select({
      id: requests.id,
      title: requests.title,
      phase: requests.phase,
      status: requests.status,
      updatedAt: requests.updatedAt,
      deadlineAt: requests.deadlineAt,
    })
    .from(requests)
    .where(eq(requests.orgId, orgId));

  const activePhaseCounts = {
    predesign: allOrgRequests.filter((r) => r.phase === "predesign").length,
    design: allOrgRequests.filter((r) => r.phase === "design").length,
    dev: allOrgRequests.filter((r) => r.phase === "dev").length,
    track: allOrgRequests.filter((r) => r.phase === "track").length,
  };

  const topRisks = await db
    .select({ type: proactiveAlerts.type, title: proactiveAlerts.title, body: proactiveAlerts.body, urgency: proactiveAlerts.urgency })
    .from(proactiveAlerts)
    .where(
      and(
        eq(proactiveAlerts.orgId, orgId),
        eq(proactiveAlerts.dismissed, false),
        gt(proactiveAlerts.expiresAt, now),
        inArray(proactiveAlerts.type, ["signoff_overdue"])
      )
    )
    .orderBy(desc(proactiveAlerts.generatedAt))
    .limit(2);

  // Note: using updatedAt as proxy for shipped date — no shippedAt column yet
  const recentlyShipped = allOrgRequests.filter(
    (r) => r.status === "shipped" && r.updatedAt >= sevenDaysAgo
  );

  // Appetite status — design-phase requests past or approaching their time budget.
  // Uses CLAUDE.md Part 8 vocabulary: "appetite" not "deadline", "exceeded" not "overdue".
  const appetiteExceeded = allOrgRequests
    .filter((r) => r.phase === "design" && r.deadlineAt && r.deadlineAt < now)
    .slice(0, 3);
  const appetiteApproaching = allOrgRequests
    .filter(
      (r) =>
        r.phase === "design" &&
        r.deadlineAt &&
        r.deadlineAt >= now &&
        r.deadlineAt <= threeDaysFromNow
    )
    .slice(0, 3);

  const topIdeas = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      voteCount: sql<number>`count(${ideaVotes.id})`.as("vote_count"),
    })
    .from(ideas)
    .leftJoin(ideaVotes, and(eq(ideaVotes.ideaId, ideas.id), eq(ideaVotes.voteType, "upvote")))
    .where(and(eq(ideas.orgId, orgId), eq(ideas.status, "pending_votes")))
    .groupBy(ideas.id, ideas.title)
    .having(sql`count(${ideaVotes.id}) > 3`)
    .orderBy(sql`count(${ideaVotes.id}) desc`)
    .limit(3);

  const shippedThisWeek = allOrgRequests.filter(
    (r) => r.status === "shipped" && r.updatedAt >= startOfThisWeek
  ).length;
  const shippedLastWeek = allOrgRequests.filter(
    (r) =>
      r.status === "shipped" &&
      r.updatedAt >= startOfLastWeek &&
      r.updatedAt < startOfThisWeek
  ).length;

  return {
    activePhaseCounts,
    topRisks,
    recentlyShipped,
    topIdeas,
    shippedThisWeek,
    shippedLastWeek,
    appetiteExceeded,
    appetiteApproaching,
  };
}

export async function generateMorningBriefing(input: {
  userId: string;
  orgId: string;
  role: string;
  userName: string;
}): Promise<MorningBriefContent> {
  const { userId, orgId, role, userName } = input;

  let contextBlock = "";

  if (role === "designer") {
    const ctx = await gatherDesignerContext(userId, orgId);
    contextBlock = `
ACTIVE REQUESTS (${ctx.activeRequests.length} total):
${ctx.activeRequests
  .map((r) => {
    const progress = [
      r.sensingSummary ? "✓sense" : "-sense",
      r.designFrameProblem ? "✓frame" : "-frame",
      r.engineeringFeasibility ? "✓feasibility" : "-feasibility",
    ].join(" ");
    const iters = ctx.iterationCountByReq.get(r.id) ?? 0;
    const decisions = ctx.decisionCountByReq.get(r.id) ?? 0;
    return `- id:${r.id} "${r.title}" — phase: ${r.phase}, design stage: ${r.designStage ?? "n/a"}, progress: [${progress}], iterations: ${iters}, decisions: ${decisions}, last updated: ${r.updatedAt.toISOString().slice(0, 10)}`;
  })
  .join("\n") || "None"}

OVERNIGHT COMMENTS (since midnight, ${ctx.overnightComments.length} total):
${ctx.overnightComments.map((c) => `- On request id:${c.requestId}: "${c.body.slice(0, 100)}"`).join("\n") || "None"}

SIGN-OFFS NEEDED (prove stage, awaiting your approval, ${ctx.pendingSignoffs.length} total):
${ctx.pendingSignoffs.map((r) => `- id:${r.id} "${r.title}"`).join("\n") || "None"}

PROACTIVE ALERTS FOR YOU (${ctx.alerts.length} total):
${ctx.alerts.map((a) => `- [${a.type}] ${a.title}: ${a.body.slice(0, 100)}`).join("\n") || "None"}

FIGMA DRIFT ALERTS — post-handoff changes unreviewed (${ctx.figmaDrifts.length} total):
${ctx.figmaDrifts.length > 0 ? `${ctx.figmaDrifts.length} Figma update(s) on your requests need dev review` : "None"}
`;
  } else if (role === "developer") {
    const ctx = await gatherDeveloperContext(userId, orgId);
    contextBlock = `
YOUR DEV WORK (${ctx.activeRequests.length} requests assigned to you):
${ctx.activeRequests.map((r) => `- id:${r.id} "${r.title}" — kanban: ${r.kanbanState ?? "n/a"}, last updated: ${r.updatedAt.toISOString().slice(0, 10)}`).join("\n") || "None"}

KANBAN STATE:
- To do: ${ctx.kanbanCounts.todo}
- In progress: ${ctx.kanbanCounts.in_progress}
- In review: ${ctx.kanbanCounts.in_review}
- Design QA: ${ctx.kanbanCounts.qa}
- Done: ${ctx.kanbanCounts.done}

OVERNIGHT COMMENTS (since midnight, ${ctx.overnightComments.length} total):
${ctx.overnightComments.map((c) => `- On request id:${c.requestId}: "${c.body.slice(0, 100)}"`).join("\n") || "None"}

FIGMA DRIFT — post-handoff changes you haven't reviewed (${ctx.figmaDrifts.length} total):
${ctx.figmaDrifts.length > 0 ? `${ctx.figmaDrifts.length} Figma update(s) on requests you own need your review` : "None"}

PROACTIVE ALERTS FOR YOU (${ctx.alerts.length} total):
${ctx.alerts.map((a) => `- [${a.type}] ${a.title}: ${a.body.slice(0, 100)}`).join("\n") || "None"}
`;
  } else if (role === "pm") {
    const ctx = await gatherPmContext(userId, orgId);
    contextBlock = `
YOUR SUBMITTED REQUESTS (${ctx.myRequests.length} total):
${ctx.myRequests.slice(0, 10).map((r) => `- id:${r.id} "${r.title}" — status: ${r.status}, phase: ${r.phase}`).join("\n") || "None"}

SIGN-OFFS PENDING FROM YOU (prove stage, ${ctx.pendingSignoffs.length} total):
${ctx.pendingSignoffs.map((r) => `- id:${r.id} "${r.title}"`).join("\n") || "None"}

IMPACT PREDICTIONS TO LOG (in track, no actual logged, ${ctx.needsImpact.length} total):
${ctx.needsImpact.map((r) => `- id:${r.id} "${r.title}"`).join("\n") || "None"}

PM CALIBRATION — recent predictions with actuals (last 30 days, framed as learning loop not scoring, ${ctx.recentCalibrations.length} total):
${ctx.recentCalibrations
  .map(
    (c) =>
      `- "${c.requestTitle}" — ${c.predictedMetric}: predicted ${c.predictedValue}, actual ${c.actualValue ?? "not yet measured"}${c.variancePercent !== null ? `, variance: ${c.variancePercent}%` : ""}`,
  )
  .join("\n") || "None"}

PROACTIVE ALERTS FOR YOU (${ctx.alerts.length} total):
${ctx.alerts.map((a) => `- [${a.type}] ${a.title}: ${a.body.slice(0, 100)}`).join("\n") || "None"}
`;
  } else if (role === "lead" || role === "admin") {
    const ctx = await gatherLeadContext(orgId);
    contextBlock = `
ORG REQUEST COUNTS BY PHASE:
- Predesign: ${ctx.activePhaseCounts.predesign}
- Design: ${ctx.activePhaseCounts.design}
- Dev: ${ctx.activePhaseCounts.dev}
- Track: ${ctx.activePhaseCounts.track}

TOP RISK ALERTS (${ctx.topRisks.length}):
${ctx.topRisks.map((a) => `- [${a.urgency}] ${a.title}: ${a.body.slice(0, 100)}`).join("\n") || "None"}

APPETITE STATUS — design-phase requests approaching or past their time budget:
- Exceeded (past appetite, ${ctx.appetiteExceeded.length}): ${ctx.appetiteExceeded.map((r) => `"${r.title}"`).join(", ") || "None"}
- Approaching (within 3 days, ${ctx.appetiteApproaching.length}): ${ctx.appetiteApproaching.map((r) => `"${r.title}"`).join(", ") || "None"}

SHIPPED IN LAST 7 DAYS: ${ctx.recentlyShipped.length} request(s)

TOP-VOTED IDEAS (>3 votes, not yet validated):
${ctx.topIdeas.map((i) => `- "${i.title}" (${i.voteCount} votes)`).join("\n") || "None"}

MOMENTUM: ${ctx.shippedThisWeek} shipped this week vs ${ctx.shippedLastWeek} last week
`;
  } else {
    contextBlock = "No role-specific context available.";
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema: briefSchema,
    prompt: `You are writing a morning briefing for a design ops platform called Lane.
Today is ${today}. The user is ${userName}, role: ${role}.

Write a warm, specific, actionable 30-second brief based on the context below.
- Items should name specific request titles, not generic status.
- Use the correct emoji for tone: ✅ (done/progress), 💬 (comments/feedback), 🔴 (risk/idle/urgent), 💡 (ideas), ⏳ (waiting/pending), 🚀 (shipped/momentum).
- oneThing must be a single concrete action the user can do in the next hour.
- If the person has no items needing attention, acknowledge this plainly — one short item like "✅ Clear queue today — nothing blocking" and a oneThing that suggests a reasonable self-directed use of time (reviewing past work, helping a teammate, thinking ahead). Do NOT fabricate items or produce saccharine filler.
- Keep each item under 15 words.
- LINKS: When an item references a specific request (shown as id:UUID in context), set href to /dashboard/requests/{UUID}. Set oneThingHref when the oneThing action is about a specific request.
- When the designer context includes progress flags (e.g. "[✓sense -frame -feasibility]"), use them to show where each request stands in the design journey, not just its stage label. "iterations: N" and "decisions: N" indicate Diverge/Converge activity.
- When the PM context includes calibration data, frame it as a learning loop — "your last prediction was close" or "worth logging the actual for X" — not a performance score.
- When the lead context includes appetite status, use Lane vocabulary: "appetite" (not "deadline"), "exceeded" (not "overdue").

---
CONTEXT:
${contextBlock}
---`,
  });

  // Runtime validation — Anthropic structured output doesn't enforce array
  // length in Zod 4 (vercel/ai#13355). Schema dropped .min(1).max(5), so we
  // validate here. Truncate if too long, throw if too short — empty briefings
  // are a real failure that should surface, not silently render as empty UI.

  const rawItems = object.items;
  let items = rawItems;

  if (rawItems.length > 5) {
    items = rawItems.slice(0, 5);
    console.warn(
      "[morning-briefing] items array exceeded max length",
      { rawLength: rawItems.length, truncatedTo: 5 }
    );
  }

  if (items.length < 1) {
    console.error(
      "[morning-briefing] AI returned zero items — briefing is unusable",
      { object }
    );
    throw new Error("Morning briefing generation failed: AI returned zero briefing items");
  }

  return { ...object, items } as MorningBriefContent;
}
