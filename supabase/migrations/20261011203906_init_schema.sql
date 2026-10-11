CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'operations', 'finance', 'support');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('success', 'failed', 'blocked', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."certification" AS ENUM('none', 'bio', 'raisonnee', 'globalgap');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('cni', 'permis', 'assurance', 'carte_grise', 'visite_technique', 'attestation_exploitation', 'ninea', 'autre');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'ok', 'refused');--> statement-breakpoint
CREATE TYPE "public"."ledger_account" AS ENUM('farmer', 'driver', 'platform');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('sale', 'commission', 'delivery_fee', 'driver_payout', 'refund_adjustment', 'payout', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."liable_party" AS ENUM('farmer', 'driver', 'platform');--> statement-breakpoint
CREATE TYPE "public"."mission_status" AS ENUM('available', 'accepted', 'pickup', 'loaded', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mission_urgency" AS ENUM('standard', 'priority', 'express');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('wave', 'orange_money', 'free_money', 'cash', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('prepaid', 'pay_on_delivery', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('requested', 'processing', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."preferred_lang" AS ENUM('fr', 'wo');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'paused', 'out');--> statement-breakpoint
CREATE TYPE "public"."proof_stage" AS ENUM('pickup', 'dropoff');--> statement-breakpoint
CREATE TYPE "public"."refund_source" AS ENUM('reception', 'dispute', 'return', 'incident', 'manual');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'approved', 'paid', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."shortage_preference" AS ENUM('partial', 'cancel');--> statement-breakpoint
CREATE TYPE "public"."stock_reason" AS ENUM('manual', 'order_reserved', 'order_cancelled', 'order_adjusted', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('restaurant', 'farmer', 'driver', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('pending', 'needs_correction', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('velo', 'moto', 'tricycle', 'camionnette', 'camion');--> statement-breakpoint
CREATE TABLE "admin_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"admin_role" "admin_role" NOT NULL,
	"team" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"status" "audit_status" DEFAULT 'success' NOT NULL,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"delivery_address" text NOT NULL,
	"zone_id" uuid,
	"payment_mode" "payment_mode" NOT NULL,
	"subtotal" integer NOT NULL,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkouts_amounts_positive" CHECK ("checkouts"."subtotal" >= 0 and "checkouts"."delivery_fee" >= 0 and "checkouts"."discount" >= 0 and "checkouts"."total" >= 0),
	CONSTRAINT "checkouts_total_consistent" CHECK ("checkouts"."total" = "checkouts"."subtotal" + "checkouts"."delivery_fee" - "checkouts"."discount")
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"base_fee" integer,
	"per_km_fee" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_fees_positive" CHECK (coalesce("cities"."base_fee", 0) >= 0 and coalesce("cities"."per_km_fee", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"stage" "proof_stage" NOT NULL,
	"code_checked" boolean DEFAULT false NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"validation_id" uuid,
	"vehicle_id" uuid,
	"kind" "document_kind" NOT NULL,
	"file_id" uuid NOT NULL,
	"expires_at" date,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_zones" (
	"driver_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	CONSTRAINT "driver_zones_driver_id_zone_id_pk" PRIMARY KEY("driver_id","zone_id")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"license_number" text,
	"working_hours" jsonb,
	"is_online" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farmers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"farm_name" text NOT NULL,
	"pickup_address" text NOT NULL,
	"zone_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"certification" "certification" DEFAULT 'none' NOT NULL,
	"area_ha" numeric(8, 2),
	"lang" "preferred_lang" DEFAULT 'fr' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_size_positive" CHECK ("files"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"checkout_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_ht" integer NOT NULL,
	"tva_rate" numeric(5, 2) DEFAULT 0 NOT NULL,
	"tva_amount" integer DEFAULT 0 NOT NULL,
	"total_ttc" integer NOT NULL,
	"file_id" uuid,
	CONSTRAINT "invoices_tva_rate_range" CHECK ("invoices"."tva_rate" >= 0 and "invoices"."tva_rate" <= 100),
	CONSTRAINT "invoices_totals_consistent" CHECK ("invoices"."total_ttc" = "invoices"."total_ht" + "invoices"."tva_amount")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account" "ledger_account" NOT NULL,
	"user_id" uuid,
	"kind" "ledger_kind" NOT NULL,
	"amount" integer NOT NULL,
	"order_id" uuid,
	"mission_id" uuid,
	"refund_id" uuid,
	"payout_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_amount_nonzero" CHECK ("ledger_entries"."amount" <> 0),
	CONSTRAINT "ledger_entries_owner" CHECK (("ledger_entries"."account" = 'platform' and "ledger_entries"."user_id" is null) or ("ledger_entries"."account" <> 'platform' and "ledger_entries"."user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "mission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"status" "mission_status",
	"actor_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"order_id" uuid NOT NULL,
	"driver_id" uuid,
	"vehicle_id" uuid,
	"status" "mission_status" DEFAULT 'available' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"distance_km" numeric(8, 2),
	"weight_kg" numeric(12, 3),
	"payout" integer NOT NULL,
	"urgency" "mission_urgency" DEFAULT 'standard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missions_payout_positive" CHECK ("missions"."payout" >= 0),
	CONSTRAINT "missions_driver_required" CHECK ("missions"."status" in ('available', 'cancelled') or "missions"."driver_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"actor_id" uuid,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price" integer NOT NULL,
	"qty_ordered" numeric(12, 3) NOT NULL,
	"qty_confirmed" numeric(12, 3),
	"qty_refused" numeric(12, 3) DEFAULT 0 NOT NULL,
	"refusal_reason" text,
	CONSTRAINT "order_items_price_positive" CHECK ("order_items"."unit_price" > 0),
	CONSTRAINT "order_items_qty_positive" CHECK ("order_items"."qty_ordered" > 0),
	CONSTRAINT "order_items_confirmed_range" CHECK ("order_items"."qty_confirmed" is null or ("order_items"."qty_confirmed" >= 0 and "order_items"."qty_confirmed" <= "order_items"."qty_ordered")),
	CONSTRAINT "order_items_refused_range" CHECK ("order_items"."qty_refused" >= 0 and "order_items"."qty_refused" <= coalesce("order_items"."qty_confirmed", "order_items"."qty_ordered"))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"checkout_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"farmer_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"shortage_preference" "shortage_preference" DEFAULT 'partial' NOT NULL,
	"pickup_code_hash" text,
	"delivery_code_hash" text,
	"tracking_token" text NOT NULL,
	"subtotal" integer NOT NULL,
	"delivered_at" timestamp with time zone,
	"reception_deadline" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_subtotal_positive" CHECK ("orders"."subtotal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider_ref" text,
	"amount" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"confirmed_by" uuid,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_confirmed_has_date" CHECK ("payments"."status" <> 'confirmed' or "payments"."paid_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider_ref" text,
	"status" "payout_status" DEFAULT 'requested' NOT NULL,
	"processed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "payouts_amount_positive" CHECK ("payouts"."amount" > 0 and "payouts"."fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_photos" (
	"product_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_photos_product_id_file_id_pk" PRIMARY KEY("product_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farmer_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit" text DEFAULT 'kg' NOT NULL,
	"price" integer NOT NULL,
	"stock_qty" numeric(12, 3) DEFAULT 0 NOT NULL,
	"min_stock" numeric(12, 3) DEFAULT 0 NOT NULL,
	"min_order_qty" numeric(12, 3),
	"available_from" date,
	"organic" boolean DEFAULT false NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_positive" CHECK ("products"."price" > 0),
	CONSTRAINT "products_stock_positive" CHECK ("products"."stock_qty" >= 0 and "products"."min_stock" >= 0),
	CONSTRAINT "products_min_order_positive" CHECK ("products"."min_order_qty" is null or "products"."min_order_qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"order_id" uuid NOT NULL,
	"source" "refund_source" NOT NULL,
	"amount" integer NOT NULL,
	"born_by" "liable_party" DEFAULT 'platform' NOT NULL,
	"method" "payment_method",
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"created_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount" > 0),
	CONSTRAINT "refunds_separation_of_duties" CHECK ("refunds"."created_by" is null or "refunds"."approved_by" is null or "refunds"."created_by" <> "refunds"."approved_by")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cuisine" text,
	"address" text NOT NULL,
	"zone_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"ninea" text,
	"reception_hours" jsonb,
	"billing_email" text,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"delivery_instructions" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurants_terms_positive" CHECK ("restaurants"."payment_terms_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"delta" numeric(12, 3) NOT NULL,
	"reason" "stock_reason" NOT NULL,
	"order_id" uuid,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_delta_nonzero" CHECK ("stock_movements"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"two_fa_enabled" boolean DEFAULT false NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"accepted_terms_at" timestamp with time zone,
	"city_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_phone_format" CHECK ("users"."phone" is null or "users"."phone" ~ '^[0-9]{9}$')
);
--> statement-breakpoint
CREATE TABLE "validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "validation_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"plate" text,
	"capacity_kg" integer NOT NULL,
	"insurance_expires_at" date,
	"inspection_expires_at" date,
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_capacity_positive" CHECK ("vehicles"."capacity_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"name" text NOT NULL,
	"delivery_fee" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zones_fee_positive" CHECK (coalesce("zones"."delivery_fee", 0) >= 0)
);
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_restaurant_id_restaurants_user_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_validation_id_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."validations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_zones" ADD CONSTRAINT "driver_zones_driver_id_drivers_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_zones" ADD CONSTRAINT "driver_zones_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmers" ADD CONSTRAINT "farmers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmers" ADD CONSTRAINT "farmers_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_events" ADD CONSTRAINT "mission_events_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_events" ADD CONSTRAINT "mission_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_driver_id_drivers_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_restaurants_user_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_farmer_id_farmers_user_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_photos" ADD CONSTRAINT "product_photos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_photos" ADD CONSTRAINT "product_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_farmer_id_farmers_user_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."farmers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validations" ADD CONSTRAINT "validations_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_drivers_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","at");--> statement-breakpoint
CREATE INDEX "audit_logs_module_idx" ON "audit_logs" USING btree ("module","at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_key" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "checkouts_reference_key" ON "checkouts" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "checkouts_restaurant_idx" ON "checkouts" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "checkouts_zone_idx" ON "checkouts" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_name_key" ON "cities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "delivery_proofs_mission_idx" ON "delivery_proofs" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "delivery_proofs_file_idx" ON "delivery_proofs" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_validation_idx" ON "documents" USING btree ("validation_id");--> statement-breakpoint
CREATE INDEX "documents_vehicle_idx" ON "documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "documents_file_idx" ON "documents" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "documents_expires_idx" ON "documents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "driver_zones_zone_idx" ON "driver_zones" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "farmers_zone_idx" ON "farmers" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_key_key" ON "files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_checkout_key" ON "invoices" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "invoices_file_idx" ON "invoices" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_user_idx" ON "ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_order_idx" ON "ledger_entries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_mission_idx" ON "ledger_entries" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_refund_idx" ON "ledger_entries" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_payout_idx" ON "ledger_entries" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "mission_events_mission_idx" ON "mission_events" USING btree ("mission_id","at");--> statement-breakpoint
CREATE INDEX "mission_events_actor_idx" ON "mission_events" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "missions_reference_key" ON "missions" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "missions_order_key" ON "missions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "missions_driver_idx" ON "missions" USING btree ("driver_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "missions_vehicle_idx" ON "missions" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "missions_status_idx" ON "missions" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","at");--> statement-breakpoint
CREATE INDEX "order_events_actor_idx" ON "order_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_key" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tracking_token_key" ON "orders" USING btree ("tracking_token");--> statement-breakpoint
CREATE INDEX "orders_checkout_idx" ON "orders" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "orders_restaurant_idx" ON "orders" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_farmer_idx" ON "orders" USING btree ("farmer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_checkout_idx" ON "payments" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "payments_confirmed_by_idx" ON "payments" USING btree ("confirmed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments" USING btree ("method","provider_ref");--> statement-breakpoint
CREATE INDEX "payouts_user_idx" ON "payouts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payouts_processed_by_idx" ON "payouts" USING btree ("processed_by");--> statement-breakpoint
CREATE INDEX "product_photos_file_idx" ON "product_photos" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "products_farmer_idx" ON "products" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_reference_key" ON "refunds" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_created_by_idx" ON "refunds" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "refunds_approved_by_idx" ON "refunds" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "restaurants_zone_idx" ON "restaurants" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_order_idx" ON "stock_movements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "stock_movements_actor_idx" ON "stock_movements" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "users_city_idx" ON "users" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "validations_user_idx" ON "validations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "validations_status_idx" ON "validations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "validations_decided_by_idx" ON "validations" USING btree ("decided_by");--> statement-breakpoint
CREATE INDEX "vehicles_driver_idx" ON "vehicles" USING btree ("driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_city_name_key" ON "zones" USING btree ("city_id","name");