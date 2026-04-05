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
  const { impactActual } = await req.json();

  if (!impactActual?.trim()) return NextResponse.json({ error: "Actual impact cannot be empty" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const [request] = await db.select().from(requests).where(eq(requests.id, requestId));
  if (!request || request.orgId !== profile.orgId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  await db
    .update(requests)
    .set({
      impactActual: impactActual.trim(),
      impactLoggedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(requests.id, requestId));

  return NextResponse.json({ success: true });
}
