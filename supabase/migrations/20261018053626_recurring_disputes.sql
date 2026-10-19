CREATE TYPE "public"."dispute_outcome" AS ENUM('refund', 'partial', 'goodwill', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."dispute_party" AS ENUM('restaurant', 'farmer', 'driver', 'platform');--> statement-breakpoint
CREATE TYPE "public"."dispute_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'investigating', 'awaiting_response', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'ended', 'problem');--> statement-breakpoint
CREATE SEQUENCE "public"."dispute_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "dispute_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"message_id" uuid,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"actor_id" uuid,
	"label" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"author_id" uuid,
	"author_role" "dispute_party" NOT NULL,
	"text" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"order_id" uuid,
	"mission_id" uuid,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"description" text NOT NULL,
	"opened_by" uuid NOT NULL,
	"opened_by_role" "dispute_party" NOT NULL,
	"against_role" "dispute_party" NOT NULL,
	"against_user_id" uuid,
	"claimed_amount" integer DEFAULT 0 NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"priority" "dispute_priority" DEFAULT 'medium' NOT NULL,
	"sla_due_at" timestamp with time zone NOT NULL,
	"escalations" integer DEFAULT 0 NOT NULL,
	"assignee_id" uuid,
	"outcome" "dispute_outcome",
	"granted_amount" integer,
	"liable_party" "dispute_party",
	"decision_reason" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"refund_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_claimed_positive" CHECK ("disputes"."claimed_amount" >= 0),
	CONSTRAINT "disputes_granted_positive" CHECK ("disputes"."granted_amount" is null or "disputes"."granted_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"order_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"farmer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	"frequency" text NOT NULL,
	"interval_days" integer,
	"days_of_week" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivery_time" text NOT NULL,
	"order_time" text NOT NULL,
	"first_delivery_on" date NOT NULL,
	"end_rule" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"delivery_address" text NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"shortage_preference" "shortage_preference" DEFAULT 'partial' NOT NULL,
	"instructions" text,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"pause_reason" text,
	"paused_until" timestamp with time zone,
	"next_delivery_on" date,
	"next_run_at" timestamp with time zone,
	"generated_count" integer DEFAULT 0 NOT NULL,
	"exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_action" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_orders_generated_positive" CHECK ("recurring_orders"."generated_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "recurring_order_id" uuid;--> statement-breakpoint
ALTER TABLE "dispute_attachments" ADD CONSTRAINT "dispute_attachments_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_attachments" ADD CONSTRAINT "dispute_attachments_message_id_dispute_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."dispute_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_attachments" ADD CONSTRAINT "dispute_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_against_user_id_users_id_fk" FOREIGN KEY ("against_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_order_events" ADD CONSTRAINT "recurring_order_events_recurring_order_id_recurring_orders_id_fk" FOREIGN KEY ("recurring_order_id") REFERENCES "public"."recurring_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_order_events" ADD CONSTRAINT "recurring_order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_orders" ADD CONSTRAINT "recurring_orders_restaurant_id_restaurants_user_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_orders" ADD CONSTRAINT "recurring_orders_farmer_id_farmers_user_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_attachments_dispute_idx" ON "dispute_attachments" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_attachments_message_idx" ON "dispute_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "dispute_attachments_file_idx" ON "dispute_attachments" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "dispute_events_dispute_idx" ON "dispute_events" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE INDEX "dispute_events_actor_idx" ON "dispute_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "dispute_messages_dispute_idx" ON "dispute_messages" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE INDEX "dispute_messages_author_idx" ON "dispute_messages" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_reference_key" ON "disputes" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "disputes_order_idx" ON "disputes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "disputes_mission_idx" ON "disputes" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "disputes_opened_by_idx" ON "disputes" USING btree ("opened_by");--> statement-breakpoint
CREATE INDEX "disputes_against_user_idx" ON "disputes" USING btree ("against_user_id");--> statement-breakpoint
CREATE INDEX "disputes_assignee_idx" ON "disputes" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "disputes_decided_by_idx" ON "disputes" USING btree ("decided_by");--> statement-breakpoint
CREATE INDEX "disputes_refund_idx" ON "disputes" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "recurring_order_events_recurring_idx" ON "recurring_order_events" USING btree ("recurring_order_id","at");--> statement-breakpoint
CREATE INDEX "recurring_order_events_order_idx" ON "recurring_order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "recurring_orders_restaurant_idx" ON "recurring_orders" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "recurring_orders_farmer_idx" ON "recurring_orders" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "recurring_orders_due_idx" ON "recurring_orders" USING btree ("status","next_run_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_recurring_order_id_recurring_orders_id_fk" FOREIGN KEY ("recurring_order_id") REFERENCES "public"."recurring_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_recurring_idx" ON "orders" USING btree ("recurring_order_id");--> statement-breakpoint
-- Nouvelles tables verrouillées comme les autres : seul le serveur y accède.
ALTER TABLE "recurring_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recurring_order_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "disputes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dispute_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dispute_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dispute_attachments" ENABLE ROW LEVEL SECURITY;
