import { NextRequest, NextResponse } from "next/server";
import { morningBriefings } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";

export async function GET(_req: NextRequest) {
  const today = new Date().toISOString().slice(0, 10);

  const result = await withAuthContext(async ({ user, db }) => {
    const [brief] = await db
      .select()
      .from(morningBriefings)
      .where(
        and(
          eq(morningBriefings.userId, user.id),
          eq(morningBriefings.date, today)
        )
      )
      .limit(1);

    return NextResponse.json({ brief: brief ?? null });
  });

  if (isAuthContextError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return result;
}
