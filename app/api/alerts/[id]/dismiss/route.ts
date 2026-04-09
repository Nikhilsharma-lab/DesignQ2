// app/api/alerts/[id]/dismiss/route.ts
import { NextResponse } from "next/server";
import { proactiveAlerts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await withAuthContext(async ({ user, db }) => {
    const result = await db
      .update(proactiveAlerts)
      .set({ dismissed: true, dismissedAt: new Date() })
      .where(
        and(
          eq(proactiveAlerts.id, id),
          eq(proactiveAlerts.recipientId, user.id) // can only dismiss own alerts
        )
      )
      .returning({ id: proactiveAlerts.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  });

  if (isAuthContextError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    return result;
  } catch (err) {
    console.error("[alerts/dismiss] DB error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
