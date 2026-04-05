import { pgTable, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./users";

export const weeklyDigests = pgTable("weekly_digests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  content: jsonb("content").notNull(),
});

export type WeeklyDigestRow = typeof weeklyDigests.$inferSelect;
