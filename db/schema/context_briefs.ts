// db/schema/context_briefs.ts
import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { requests } from "./requests";

export const requestContextBriefs = pgTable("request_context_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .unique()
    .references(() => requests.id, { onDelete: "cascade" }),

  // The 5 sections
  plainSummary: text("plain_summary").notNull(),
  relatedRequests: jsonb("related_requests")
    .$type<{ id: string; title: string; reason: string }[]>()
    .notNull()
    .default([]),
  keyConstraints: jsonb("key_constraints")
    .$type<string[]>()
    .notNull()
    .default([]),
  questionsToAsk: jsonb("questions_to_ask")
    .$type<string[]>()
    .notNull()
    .default([]),
  explorationDirections: jsonb("exploration_directions")
    .$type<string[]>()
    .notNull()
    .default([]),

  // Metadata
  aiModel: text("ai_model").notNull(),
  tokensUsed: integer("tokens_used"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RequestContextBrief = typeof requestContextBriefs.$inferSelect;
export type NewRequestContextBrief = typeof requestContextBriefs.$inferInsert;
