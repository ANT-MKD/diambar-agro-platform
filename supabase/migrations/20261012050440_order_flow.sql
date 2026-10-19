CREATE SEQUENCE "public"."checkout_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."mission_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 4301 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."order_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 3101 CACHE 1;--> statement-breakpoint
ALTER TABLE "checkouts" ADD COLUMN "slot_label" text;--> statement-breakpoint
ALTER TABLE "checkouts" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_with_code" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reception_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reception_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fees_positive" CHECK ("orders"."delivery_fee" >= 0 and "orders"."discount" >= 0);--> statement-breakpoint
-- Compteurs de références : comme les tables, réservés au serveur.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
