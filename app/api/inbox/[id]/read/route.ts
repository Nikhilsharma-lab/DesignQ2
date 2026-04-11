import { NextResponse } from "next/server";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";
import { notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let unread = false;
  try {
    const body = await req.json();
    if (body?.unread === true) {
      unread = true;
    }
  } catch {
    // No body or invalid JSON — default to marking as read
  }

  const result = await withAuthContext(async ({ user, db }) => {
    await db
      .update(notifications)
      .set({ readAt: unread ? null : new Date() })
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
