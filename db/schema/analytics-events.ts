import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { workspaces } from "./users";

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id"),
    eventName: text("event_name").notNull(),
    properties: jsonb("properties").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userTimeIdx: index("analytics_events_user_time").on(
      table.userId,
      table.createdAt
    ),
    nameTimeIdx: index("analytics_events_name_time").on(
      table.eventName,
      table.createdAt
    ),
  })
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
