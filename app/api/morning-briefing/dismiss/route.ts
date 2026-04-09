import { NextRequest, NextResponse } from "next/server";
import { morningBriefings } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";

export async function POST(_req: NextRequest) {
  const today = new Date().toISOString().slice(0, 10);

  const result = await withAuthContext(async ({ user, db }) => {
    const [existing] = await db
      .select({ id: morningBriefings.id })
      .from(morningBriefings)
      .where(
        and(
          eq(morningBriefings.userId, user.id),
          eq(morningBriefings.date, today)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "No brief found" }, { status: 404 });
    }

    await db
      .update(morningBriefings)
      .set({ dismissedAt: new Date() })
      .where(
        and(
          eq(morningBriefings.userId, user.id),
          eq(morningBriefings.date, today)
        )
      );

    return NextResponse.json({ ok: true });
  });

  if (isAuthContextError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return result;
}
