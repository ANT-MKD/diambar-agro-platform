CREATE TYPE "public"."credit_note_status" AS ENUM('active', 'used', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."dispute_outcome" ADD VALUE 'credit' BEFORE 'goodwill';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE 'credit';--> statement-breakpoint
CREATE SEQUENCE "public"."credit_note_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "credit_note_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"restored" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_note_uses_amount_positive" CHECK ("credit_note_uses"."amount" > 0),
	CONSTRAINT "credit_note_uses_restored_range" CHECK ("credit_note_uses"."restored" >= 0 and "credit_note_uses"."restored" <= "credit_note_uses"."amount")
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"dispute_id" uuid,
	"born_by" "liable_party" DEFAULT 'platform' NOT NULL,
	"reason" text,
	"status" "credit_note_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_amount_positive" CHECK ("credit_notes"."amount" > 0),
	CONSTRAINT "credit_notes_balance_range" CHECK ("credit_notes"."balance" >= 0 and "credit_notes"."balance" <= "credit_notes"."amount")
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "farmers" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "farmers" ADD COLUMN "production_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_note_uses" ADD CONSTRAINT "credit_note_uses_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_uses" ADD CONSTRAINT "credit_note_uses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_restaurant_id_restaurants_user_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_note_uses_note_idx" ON "credit_note_uses" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "credit_note_uses_order_idx" ON "credit_note_uses" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_reference_key" ON "credit_notes" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "credit_notes_restaurant_idx" ON "credit_notes" USING btree ("restaurant_id","status");--> statement-breakpoint
CREATE INDEX "credit_notes_dispute_idx" ON "credit_notes" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "credit_notes_created_by_idx" ON "credit_notes" USING btree ("created_by");--> statement-breakpoint
-- Nouvelles tables verrouillées comme les autres : seul le serveur y accède.
ALTER TABLE "credit_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_note_uses" ENABLE ROW LEVEL SECURITY;
