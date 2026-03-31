import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles, requests, assignments, comments } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgRequests = await db
    .select({ id: requests.id, title: requests.title, requesterId: requests.requesterId })
    .from(requests)
    .where(eq(requests.orgId, profile.orgId));

  const orgReqIds = orgRequests.map((r) => r.id);
  if (orgReqIds.length === 0) return NextResponse.json({ items: [] });

  const events: {
    id: string;
    type: "assigned" | "comment" | "stage";
    requestId: string;
    requestTitle: string;
    body: string;
    createdAt: Date;
    forYou: boolean;
  }[] = [];

  // Assignments for current user
  const myAssignments = await db
    .select({ id: assignments.id, requestId: assignments.requestId, assignedAt: assignments.assignedAt, assignedById: assignments.assignedById })
    .from(assignments)
    .where(eq(assignments.assigneeId, user.id))
    .orderBy(desc(assignments.assignedAt));

  for (const a of myAssignments.slice(0, 10)) {
    const req = orgRequests.find((r) => r.id === a.requestId);
    if (!req) continue;
    let assigner = "Someone";
    if (a.assignedById) {
      const [p] = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, a.assignedById));
      if (p) assigner = p.fullName;
    }
    events.push({
      id: `assign-${a.id}`,
      type: "assigned",
      requestId: a.requestId,
      requestTitle: req.title,
      body: `${assigner} assigned you to this request`,
      createdAt: a.assignedAt,
      forYou: true,
    });
  }

  // Comments on requests you submitted or are assigned to
  const myRequestIds = new Set([
    ...orgRequests.filter((r) => r.requesterId === user.id).map((r) => r.id),
    ...myAssignments.map((a) => a.requestId),
  ]);

  if (myRequestIds.size > 0) {
    const recentComments = await db
      .select()
      .from(comments)
      .where(inArray(comments.requestId, [...myRequestIds]))
      .orderBy(desc(comments.createdAt));

    for (const c of recentComments.slice(0, 15)) {
      if (c.authorId === user.id) continue; // skip your own
      const req = orgRequests.find((r) => r.id === c.requestId);
      if (!req) continue;

      let authorName = "AI";
      if (c.authorId) {
        const [p] = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, c.authorId));
        if (p) authorName = p.fullName;
      }

      events.push({
        id: `comment-${c.id}`,
        type: c.isSystem ? "stage" : "comment",
        requestId: c.requestId,
        requestTitle: req.title,
        body: c.isSystem ? c.body : `${authorName}: "${c.body.slice(0, 80)}${c.body.length > 80 ? "…" : ""}"`,
        createdAt: c.createdAt,
        forYou: req.requesterId === user.id || myAssignments.some((a) => a.requestId === c.requestId),
      });
    }
  }

  // Sort all events by recency and cap at 20
  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ items: events.slice(0, 20) });
}
