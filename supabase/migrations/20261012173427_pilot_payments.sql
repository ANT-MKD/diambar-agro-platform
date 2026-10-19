ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."refund_source" ADD VALUE IF NOT EXISTS 'shortage';--> statement-breakpoint
ALTER TYPE "public"."refund_source" ADD VALUE IF NOT EXISTS 'cancellation';--> statement-breakpoint
CREATE SEQUENCE "public"."payout_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 201 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."refund_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 501 CACHE 1;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_share" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "declared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "declared_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "collected_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "collected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "paid_to" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "provider_ref" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_declared_by_users_id_fk" FOREIGN KEY ("declared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_collected_by_users_id_fk" FOREIGN KEY ("collected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_declared_by_idx" ON "payments" USING btree ("declared_by");--> statement-breakpoint
CREATE INDEX "payments_collected_by_idx" ON "payments" USING btree ("collected_by");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_reference_key" ON "payouts" USING btree ("reference");--> statement-breakpoint
-- Nouveaux compteurs de références : réservés au serveur, comme les autres.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
    END IF;
  END LOOP;
END
$$;
