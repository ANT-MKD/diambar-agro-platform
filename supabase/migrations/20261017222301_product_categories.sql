CREATE TYPE "public"."category_status" AS ENUM('approved', 'proposed');--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "status" "category_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;