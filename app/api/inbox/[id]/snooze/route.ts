import { NextResponse } from "next/server";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";
import { notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let until: string;
  try {
    const body = await req.json();
    until = body.until;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!until) {
    return NextResponse.json(
      { error: "Missing 'until' field" },
      { status: 400 }
    );
  }

  const snoozedUntil = new Date(until);
  if (isNaN(snoozedUntil.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format for 'until'" },
      { status: 400 }
    );
  }

  if (snoozedUntil <= new Date()) {
    return NextResponse.json(
      { error: "'until' must be in the future" },
      { status: 400 }
    );
  }

  const result = await withAuthContext(async ({ user, db }) => {
    await db
      .update(notifications)
      .set({ snoozedUntil, archivedAt: null })
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
