import { NextRequest, NextResponse } from "next/server";
import { morningBriefings } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";
import { generateMorningBriefing } from "@/lib/ai/morning-briefing";

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

// On-demand generation — called by the refresh button and on first load
export async function POST(_req: NextRequest) {
  const today = new Date().toISOString().slice(0, 10);

  const result = await withAuthContext(async ({ user, profile, db }) => {
    // Delete existing dismissedAt briefing so a fresh one can be shown
    await db
      .delete(morningBriefings)
      .where(
        and(
          eq(morningBriefings.userId, user.id),
          eq(morningBriefings.date, today)
        )
      );

    const content = await generateMorningBriefing({
      userId: user.id,
      orgId: profile.orgId,
      role: profile.role,
      userName: profile.fullName || "there",
    });

    const [row] = await db
      .insert(morningBriefings)
      .values({
        userId: user.id,
        orgId: profile.orgId,
        date: today,
        role: profile.role,
        content,
      })
      .returning();

    return NextResponse.json({ brief: row });
  });

  if (isAuthContextError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return result;
}
