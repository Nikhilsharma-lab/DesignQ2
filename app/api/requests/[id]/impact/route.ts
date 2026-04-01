import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { requests } from "@/db/schema";
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
