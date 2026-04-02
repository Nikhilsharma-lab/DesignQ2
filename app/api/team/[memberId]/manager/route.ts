import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const { managerId } = await req.json() as { managerId: string | null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [viewer] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id));
  if (!viewer || viewer.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  if (managerId === memberId) {
    return NextResponse.json({ error: "Cannot report to yourself" }, { status: 400 });
  }

  await db
    .update(profiles)
    .set({ managerId: managerId ?? null })
    .where(eq(profiles.id, memberId));

  return NextResponse.json({ success: true });
}
