import { NextRequest, NextResponse } from "next/server";
import { isAuthContextError, withAuthContext } from "@/lib/auth-context";
import { notifications, profiles } from "@/db/schema";
import { eq, and, isNull, lte, or, desc, count, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab") ?? "inbox";

  const result = await withAuthContext(async ({ user, db }) => {
    const actor = alias(profiles, "actor");
    const now = new Date();

    let items;

    if (tab === "done") {
      items = await db
        .select({
          id: notifications.id,
          orgId: notifications.orgId,
          recipientId: notifications.recipientId,
          actorId: notifications.actorId,
          type: notifications.type,
          requestId: notifications.requestId,
          title: notifications.title,
          body: notifications.body,
          url: notifications.url,
          readAt: notifications.readAt,
          archivedAt: notifications.archivedAt,
          snoozedUntil: notifications.snoozedUntil,
          createdAt: notifications.createdAt,
          actorName: actor.fullName,
        })
        .from(notifications)
        .leftJoin(actor, eq(notifications.actorId, actor.id))
        .where(
          and(
            eq(notifications.recipientId, user.id),
            sql`${notifications.archivedAt} IS NOT NULL`
          )
        )
        .orderBy(desc(notifications.archivedAt))
        .limit(50);
    } else {
      items = await db
        .select({
          id: notifications.id,
          orgId: notifications.orgId,
          recipientId: notifications.recipientId,
          actorId: notifications.actorId,
          type: notifications.type,
          requestId: notifications.requestId,
          title: notifications.title,
          body: notifications.body,
          url: notifications.url,
          readAt: notifications.readAt,
          archivedAt: notifications.archivedAt,
          snoozedUntil: notifications.snoozedUntil,
          createdAt: notifications.createdAt,
          actorName: actor.fullName,
        })
        .from(notifications)
        .leftJoin(actor, eq(notifications.actorId, actor.id))
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
        .orderBy(desc(notifications.createdAt))
        .limit(100);
    }

    // Always compute unread count for the inbox badge
    const [unreadResult] = await db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, user.id),
          isNull(notifications.archivedAt),
          isNull(notifications.readAt),
          or(
            isNull(notifications.snoozedUntil),
            lte(notifications.snoozedUntil, now)
          )
        )
      );

    return NextResponse.json({
      notifications: items,
      unreadCount: unreadResult.value,
    });
  });

  if (isAuthContextError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return result;
}
