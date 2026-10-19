CREATE TYPE "public"."team_member_status" AS ENUM('invited', 'active', 'revoked');--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" "team_member_status" DEFAULT 'invited' NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_email_lowercase" CHECK ("team_members"."email" = lower("team_members"."email"))
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_members_owner_idx" ON "team_members" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_user_key" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_members_invited_by_idx" ON "team_members" USING btree ("invited_by");--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
