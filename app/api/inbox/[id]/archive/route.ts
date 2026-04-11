import { NextResponse } from "next/server";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";
import { notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await withAuthContext(async ({ user, db }) => {
    await db
      .update(notifications)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, user.id)
        )
      );

    return NextResponse.json({ ok: true });
  });

  if (isAuthContextError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return result;
}
