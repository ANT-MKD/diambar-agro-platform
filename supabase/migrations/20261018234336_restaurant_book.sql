CREATE TABLE "product_favorites" (
	"restaurant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_favorites_restaurant_id_product_id_pk" PRIMARY KEY("restaurant_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "restaurant_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"farmer_id" uuid,
	"name" text NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"notes" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "budget" jsonb;--> statement-breakpoint
ALTER TABLE "product_favorites" ADD CONSTRAINT "product_favorites_restaurant_id_users_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_favorites" ADD CONSTRAINT "product_favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_suppliers" ADD CONSTRAINT "restaurant_suppliers_restaurant_id_users_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_suppliers" ADD CONSTRAINT "restaurant_suppliers_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_favorites_product_idx" ON "product_favorites" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "restaurant_suppliers_restaurant_idx" ON "restaurant_suppliers" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "restaurant_suppliers_farmer_idx" ON "restaurant_suppliers" USING btree ("farmer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_suppliers_farmer_key" ON "restaurant_suppliers" USING btree ("restaurant_id","farmer_id") WHERE "restaurant_suppliers"."farmer_id" is not null;--> statement-breakpoint
ALTER TABLE "restaurant_suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_favorites" ENABLE ROW LEVEL SECURITY;
