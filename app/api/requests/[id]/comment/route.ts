import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withUserDb } from "@/db/user";
import { comments, profiles, requests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notifyMany, getRequestRecipients } from "@/lib/notifications";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params;

  if (!UUID_RE.test(requestId)) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
  }

  const { body, isDevQuestion } = await req.json();

  if (!body?.trim()) return NextResponse.json({ error: "Comment cannot be empty" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return withUserDb(user.id, async (db) => {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const [request] = await db.select().from(requests).where(eq(requests.id, requestId));
    if (!request || request.orgId !== profile.orgId) {
      return NextResponse.json({ error: "Request not found" }, { status: 403 });
    }

    await db.insert(comments).values({
      requestId,
      authorId: user.id,
      body: body.trim(),
      isSystem: false,
      isDevQuestion: Boolean(isDevQuestion),
    });

    // In-app notifications to requester + all assignees
    const recipients = await getRequestRecipients(db, requestId, request.requesterId);
    await notifyMany(db, {
      orgId: profile.orgId,
      recipientIds: recipients,
      actorId: user.id,
      type: "comment",
      requestId,
      title: `${profile.fullName ?? "Someone"} commented on ${request.title}`,
      body: body.trim().slice(0, 120),
      url: `/dashboard/requests/${requestId}`,
    });

    return NextResponse.json({ success: true });
  });
}
