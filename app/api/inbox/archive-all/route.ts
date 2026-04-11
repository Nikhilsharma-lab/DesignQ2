import { NextResponse } from "next/server";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";
import { notifications } from "@/db/schema";
import { eq, and, isNull, lte, or, sql } from "drizzle-orm";

export async function POST() {
  const result = await withAuthContext(async ({ user, db }) => {
    const now = new Date();

    const updated = await db
      .update(notifications)
      .set({ archivedAt: now })
      .where(
        and(
          eq(notifications.recipientId, user.id),
          isNull(notifications.archivedAt),
          or(
            isNull(notifications.snoozedUntil),
            lte(notifications.snoozedUntil, now)
          )
        )
      )
      .returning({ id: notifications.id });

    return NextResponse.json({ archived: updated.length });
  });

  if (isAuthContextError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return result;
}
