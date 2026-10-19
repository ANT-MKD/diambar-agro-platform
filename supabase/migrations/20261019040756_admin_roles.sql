CREATE TABLE "admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"system_key" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_roles_name_length" CHECK (char_length("admin_roles"."name") between 2 and 60)
);
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "admin_roles_system_key_key" ON "admin_roles" USING btree ("system_key");--> statement-breakpoint
CREATE INDEX "admin_roles_created_by_idx" ON "admin_roles" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_profiles_role_idx" ON "admin_profiles" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "admin_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "admin_roles" ("name", "description", "permissions", "system_key") VALUES
  ('Opérations', 'Inscriptions, commandes, livraisons, incidents, litiges et retours.', ARRAY['users.view', 'users.edit', 'validations.decide', 'moderation.decide', 'catalog.manage', 'orders.view', 'orders.manage', 'deliveries.view', 'deliveries.reassign', 'drivers.verify', 'pricing.edit', 'incidents.decide', 'disputes.decide', 'support.respond', 'returns.decide', 'messages.view', 'audit.view']::text[], 'operations'),
  ('Finance', 'Encaissements, retraits, remboursements et données financières.', ARRAY['users.view', 'orders.view', 'refunds.view', 'refunds.approve', 'refunds.execute', 'finance.view', 'finance.edit', 'audit.view', 'audit.export']::text[], 'finance'),
  ('Support', 'Support, messages, litiges et retours.', ARRAY['users.view', 'orders.view', 'support.respond', 'disputes.decide', 'returns.decide', 'messages.view', 'audit.view']::text[], 'support'),
  ('Modération', 'Modération des produits et des avis.', ARRAY['users.view', 'moderation.decide', 'audit.view']::text[], 'moderation');--> statement-breakpoint
UPDATE "admin_profiles" SET "role_id" = r."id" FROM "admin_roles" r WHERE r."system_key" = "admin_profiles"."admin_role"::text AND "admin_profiles"."admin_role" <> 'super_admin';
