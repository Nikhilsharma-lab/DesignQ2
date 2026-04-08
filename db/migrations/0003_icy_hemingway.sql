CREATE TYPE "public"."alert_type" AS ENUM('stall_nudge', 'stall_escalation', 'signoff_overdue', 'figma_drift');--> statement-breakpoint
CREATE TYPE "public"."alert_urgency" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "proactive_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"request_id" uuid,
	"recipient_id" uuid NOT NULL,
	"type" "alert_type" NOT NULL,
	"urgency" "alert_urgency" DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"cta_label" text NOT NULL,
	"cta_url" text NOT NULL,
	"rule_key" text NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"dismissed_at" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "proactive_alerts_rule_key_unique" UNIQUE("rule_key")
);
--> statement-breakpoint
ALTER TABLE "proactive_alerts" ADD CONSTRAINT "proactive_alerts_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proactive_alerts" ADD CONSTRAINT "proactive_alerts_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;