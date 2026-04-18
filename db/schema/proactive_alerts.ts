import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { requests } from "./requests";

export const alertTypeEnum = pgEnum("alert_type", [
  "stall_nudge",        // private to designer — no movement 5+ days
  "stall_escalation",   // DEPRECATED — violates anti-surveillance principles. No code creates this type. Safe to remove in a future enum migration.
  "signoff_overdue",    // to PM or Design Head — validate stage 3+ days, not signed
  "figma_drift",        // to dev + Design Head — post-handoff change unreviewed 24h+
]);

export const alertUrgencyEnum = pgEnum("alert_urgency", [
  "low",
  "medium",
  "high",
]);

export const proactiveAlerts = pgTable("proactive_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  requestId: uuid("request_id").references(() => requests.id, {
    onDelete: "cascade",
  }),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: alertTypeEnum("type").notNull(),
  urgency: alertUrgencyEnum("urgency").notNull().default("medium"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  ctaLabel: text("cta_label").notNull(),
  ctaUrl: text("cta_url").notNull(),
  // Dedup key — unique constraint prevents re-alerting same condition
  ruleKey: text("rule_key").notNull().unique(),
  dismissed: boolean("dismissed").notNull().default(false),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Auto-expire after 7 days — excluded from queries after this date
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type ProactiveAlert = typeof proactiveAlerts.$inferSelect;
export type NewProactiveAlert = typeof proactiveAlerts.$inferInsert;
