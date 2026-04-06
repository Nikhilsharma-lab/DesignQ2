CREATE TABLE "request_handoff_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"design_decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"build_sequence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"figma_notes" text DEFAULT '' NOT NULL,
	"edge_cases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_model" text NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_handoff_briefs_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content" jsonb NOT NULL,
	CONSTRAINT "weekly_digests_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "prediction_confidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"label" text NOT NULL,
	"rationale" text NOT NULL,
	"red_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggestion" text,
	"ai_model" text NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prediction_confidence_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "impact_retrospectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"headline" text NOT NULL,
	"what_happened" text NOT NULL,
	"likely_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_time_suggestion" text NOT NULL,
	"celebrate" text,
	"ai_model" text NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "impact_retrospectives_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "design_stage" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."design_stage";--> statement-breakpoint
CREATE TYPE "public"."design_stage" AS ENUM('sense', 'frame', 'diverge', 'converge', 'prove');--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "design_stage" SET DATA TYPE "public"."design_stage" USING "design_stage"::"public"."design_stage";--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "is_dev_question" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "designer_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "request_handoff_briefs" ADD CONSTRAINT "request_handoff_briefs_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_digests" ADD CONSTRAINT "weekly_digests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_confidence" ADD CONSTRAINT "prediction_confidence_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_retrospectives" ADD CONSTRAINT "impact_retrospectives_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_designer_owner_id_profiles_id_fk" FOREIGN KEY ("designer_owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;