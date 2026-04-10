import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, requests, requestAiAnalysis } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import { IntakeClientWrapper } from "./intake-client";

export default async function IntakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) redirect("/signup");

  // Fetch intake requests that are NOT snoozed
  const intakeRequests = await db
    .select({
      id: requests.id,
      title: requests.title,
      description: requests.description,
      businessContext: requests.businessContext,
      successMetrics: requests.successMetrics,
      priority: requests.priority,
      createdAt: requests.createdAt,
      requesterId: requests.requesterId,
    })
    .from(requests)
    .where(
      and(
        eq(requests.orgId, profile.orgId),
        eq(requests.phase, "predesign"),
        eq(requests.predesignStage, "intake"),
        isNull(requests.snoozedUntil)
      )
    )
    .orderBy(requests.createdAt);

  if (intakeRequests.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <EmptyState
          icon={Inbox}
          title="No requests waiting."
          subtitle="The intake is clear."
        />
      </div>
    );
  }

  // Fetch AI analyses for these requests
  const requestIds = intakeRequests.map((r) => r.id);
  const allAnalyses = await db
    .select()
    .from(requestAiAnalysis)
    .where(inArray(requestAiAnalysis.requestId, requestIds));

  const analysisMap = new Map(allAnalyses.map((a) => [a.requestId, a]));

  // Fetch requester names
  const requesterIds = [...new Set(intakeRequests.map((r) => r.requesterId))];
  const requesterProfiles = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(inArray(profiles.id, requesterIds));

  const nameMap = new Map(requesterProfiles.map((p) => [p.id, p.fullName]));

  // Build the data for client components
  const sidebarRequests = intakeRequests.map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority,
    requesterName: nameMap.get(r.requesterId) ?? "Unknown",
    createdAt: r.createdAt.toISOString(),
    hasAiAnalysis: analysisMap.has(r.id),
  }));

  const detailRequests = intakeRequests.map((r) => {
    const analysis = analysisMap.get(r.id);
    return {
      request: {
        id: r.id,
        title: r.title,
        description: r.description,
        businessContext: r.businessContext,
        successMetrics: r.successMetrics,
        priority: r.priority,
        createdAt: r.createdAt.toISOString(),
        requesterName: nameMap.get(r.requesterId) ?? "Unknown",
      },
      aiAnalysis: analysis
        ? {
            priority: analysis.priority,
            complexity: analysis.complexity,
            requestType: analysis.requestType,
            qualityScore: analysis.qualityScore,
            summary: analysis.summary,
            reasoning: analysis.reasoning,
            suggestions: analysis.suggestions,
            potentialDuplicates: analysis.potentialDuplicates,
          }
        : null,
    };
  });

  return (
    <IntakeClientWrapper
      sidebarRequests={sidebarRequests}
      detailRequests={detailRequests}
    />
  );
}
