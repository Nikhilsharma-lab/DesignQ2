import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { profiles, organizations } from "./users";

export interface BriefItem {
  icon: string;    // emoji: "🔴" | "✅" | "💬" | "💡" | "⏳" | "🚀"
  text: string;
  href?: string;   // e.g. "/dashboard/requests/abc-123"
}

export interface MorningBriefContent {
  greeting: string;      // "Good morning, Yash"
  items: BriefItem[];    // 3–5 role-specific bullets
  oneThing: string;      // "Today: push checkout redesign to Prove"
  oneThingHref?: string; // CTA link for oneThing action
}

export const morningBriefings = pgTable(
  "morning_briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: text("date").notNull(),   // "YYYY-MM-DD"
    role: text("role").notNull(),   // "designer" | "pm" | "lead" | "admin"
    content: jsonb("content").notNull().$type<MorningBriefContent>(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (table) => ({
    userDateUniq: unique().on(table.userId, table.date),
  })
);

export type MorningBriefingRow = typeof morningBriefings.$inferSelect;
