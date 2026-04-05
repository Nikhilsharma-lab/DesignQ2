import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { requests, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params;
  const data = await req.json();

  if (!data.title?.trim() || !data.description?.trim()) {
    return NextResponse.json({ error: "Title and description are required" });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const [request] = await db.select().from(requests).where(eq(requests.id, requestId));
  if (!request || request.orgId !== profile.orgId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const canEdit =
    request.requesterId === user.id ||
    profile.role === "lead" ||
    profile.role === "admin";
  if (!canEdit) return NextResponse.json({ error: "Only the requester or a lead can edit" }, { status: 403 });

  await db
    .update(requests)
    .set({
      title: data.title.trim(),
      description: data.description.trim(),
      businessContext: data.businessContext?.trim() || null,
      successMetrics: data.successMetrics?.trim() || null,
      figmaUrl: data.figmaUrl?.trim() || null,
      impactMetric: data.impactMetric?.trim() || null,
      impactPrediction: data.impactPrediction?.trim() || null,
      deadlineAt: data.deadlineAt ? new Date(data.deadlineAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(requests.id, requestId));

  return NextResponse.json({ success: true });
}
