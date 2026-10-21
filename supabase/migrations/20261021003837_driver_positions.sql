CREATE TABLE "mission_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy_m" real,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "last_lat" double precision;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "last_lng" double precision;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "last_accuracy_m" real;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "last_heading" real;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "last_speed_kmh" real;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "last_position_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mission_positions" ADD CONSTRAINT "mission_positions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_positions_mission_idx" ON "mission_positions" USING btree ("mission_id","at");--> statement-breakpoint
-- Comme les autres tables : fermée à l'API publique de Supabase, seul le serveur y accède.
ALTER TABLE "mission_positions" ENABLE ROW LEVEL SECURITY;
