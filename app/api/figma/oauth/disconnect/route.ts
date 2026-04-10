// app/api/figma/oauth/disconnect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withUserDb } from "@/db/user";
import { profiles, figmaConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return withUserDb(user.id, async (db) => {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (profile.role !== "admin" && profile.role !== "lead") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(figmaConnections).where(eq(figmaConnections.orgId, profile.orgId));

    return NextResponse.redirect(new URL("/settings/integrations", req.url));
  });
}
