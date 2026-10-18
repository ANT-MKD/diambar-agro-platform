CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'escalated', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('client_absent', 'refused', 'breakdown', 'accident', 'traffic', 'address', 'other');--> statement-breakpoint
CREATE TYPE "public"."product_report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('quality', 'quantity', 'wrong_item', 'damaged', 'late', 'other');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('pending', 'accepted', 'refused', 'credited');--> statement-breakpoint
CREATE SEQUENCE "public"."incident_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."return_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "incident_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"actor_id" uuid,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"mission_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"type" "incident_type" NOT NULL,
	"severity" "incident_severity" NOT NULL,
	"description" text NOT NULL,
	"waited_minutes" integer DEFAULT 0 NOT NULL,
	"compensation_requested" integer DEFAULT 0 NOT NULL,
	"compensation_awarded" integer,
	"resolution_note" text,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_amounts_range" CHECK ("incidents"."waited_minutes" >= 0 and "incidents"."compensation_requested" >= 0 and ("incidents"."compensation_awarded" is null or "incidents"."compensation_awarded" >= 0))
);
--> statement-breakpoint
CREATE TABLE "moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"actor_id" uuid,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "product_report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"actor_id" uuid,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"author_role" "dispute_party" NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"farmer_id" uuid NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"reason" "return_reason" NOT NULL,
	"description" text NOT NULL,
	"requested_amount" integer NOT NULL,
	"awarded_amount" integer,
	"status" "return_status" DEFAULT 'pending' NOT NULL,
	"decision_note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"refund_id" uuid,
	"credit_note_id" uuid,
	"pickup" jsonb,
	"inspection" jsonb,
	"resolution" jsonb,
	"dispute_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_requests_amount_positive" CHECK ("return_requests"."requested_amount" > 0),
	CONSTRAINT "return_requests_qty_positive" CHECK ("return_requests"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"farmer_id" uuid NOT NULL,
	"driver_id" uuid,
	"quality" integer NOT NULL,
	"quantity" integer NOT NULL,
	"freshness" integer NOT NULL,
	"timeliness" integer NOT NULL,
	"packaging" integer NOT NULL,
	"communication" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reply" text,
	"replied_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_scores_range" CHECK ("reviews"."quality" between 1 and 5 and "reviews"."quantity" between 1 and 5 and "reviews"."freshness" between 1 and 5 and "reviews"."timeliness" between 1 and 5 and "reviews"."packaging" between 1 and 5 and "reviews"."communication" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_photos" ADD CONSTRAINT "incident_photos_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_photos" ADD CONSTRAINT "incident_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reports" ADD CONSTRAINT "product_reports_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reports" ADD CONSTRAINT "product_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reports" ADD CONSTRAINT "product_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_events" ADD CONSTRAINT "return_events_return_id_return_requests_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."return_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_events" ADD CONSTRAINT "return_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_messages" ADD CONSTRAINT "return_messages_return_id_return_requests_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."return_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_messages" ADD CONSTRAINT "return_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_photos" ADD CONSTRAINT "return_photos_return_id_return_requests_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."return_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_photos" ADD CONSTRAINT "return_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_photos" ADD CONSTRAINT "return_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_restaurant_id_users_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restaurant_id_users_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incident_events_incident_idx" ON "incident_events" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "incident_events_actor_idx" ON "incident_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "incident_photos_incident_idx" ON "incident_photos" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_photos_file_idx" ON "incident_photos" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_reference_key" ON "incidents" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "incidents_mission_idx" ON "incidents" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "incidents_driver_idx" ON "incidents" USING btree ("driver_id","created_at");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_resolved_by_idx" ON "incidents" USING btree ("resolved_by");--> statement-breakpoint
CREATE INDEX "moderation_events_product_idx" ON "moderation_events" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_events_actor_idx" ON "moderation_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "product_reports_product_idx" ON "product_reports" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "product_reports_reporter_idx" ON "product_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "product_reports_resolved_by_idx" ON "product_reports" USING btree ("resolved_by");--> statement-breakpoint
CREATE INDEX "return_events_return_idx" ON "return_events" USING btree ("return_id","created_at");--> statement-breakpoint
CREATE INDEX "return_events_actor_idx" ON "return_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "return_messages_return_idx" ON "return_messages" USING btree ("return_id","created_at");--> statement-breakpoint
CREATE INDEX "return_messages_author_idx" ON "return_messages" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "return_photos_return_idx" ON "return_photos" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "return_photos_file_idx" ON "return_photos" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "return_photos_uploaded_by_idx" ON "return_photos" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_reference_key" ON "return_requests" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "return_requests_order_idx" ON "return_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "return_requests_item_idx" ON "return_requests" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "return_requests_restaurant_idx" ON "return_requests" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "return_requests_farmer_idx" ON "return_requests" USING btree ("farmer_id","created_at");--> statement-breakpoint
CREATE INDEX "return_requests_decided_by_idx" ON "return_requests" USING btree ("decided_by");--> statement-breakpoint
CREATE INDEX "return_requests_refund_idx" ON "return_requests" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "return_requests_credit_note_idx" ON "return_requests" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "return_requests_dispute_idx" ON "return_requests" USING btree ("dispute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_order_key" ON "reviews" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "reviews_restaurant_idx" ON "reviews" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "reviews_farmer_idx" ON "reviews" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "reviews_driver_idx" ON "reviews" USING btree ("driver_id");--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "moderation_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "return_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "return_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "return_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "return_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incident_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incident_photos" ENABLE ROW LEVEL SECURITY;
