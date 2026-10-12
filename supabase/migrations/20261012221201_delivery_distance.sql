ALTER TABLE "cities" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "farmers" ADD COLUMN "distance_adjust_km" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "distance_km" numeric(7, 1);--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "lng" double precision;