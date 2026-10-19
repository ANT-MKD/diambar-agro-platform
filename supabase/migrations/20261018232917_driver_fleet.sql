CREATE TYPE "public"."renewal_doc" AS ENUM('insurance', 'inspection');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vehicle_change_reason" AS ENUM('sold', 'breakdown', 'new_vehicle', 'rental', 'other');--> statement-breakpoint
CREATE TYPE "public"."vehicle_issue_severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."vehicle_issue_status" AS ENUM('reported', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."vehicle_issue_type" AS ENUM('tires', 'brakes', 'battery', 'engine', 'lights', 'other');--> statement-breakpoint
CREATE SEQUENCE "public"."vehicle_change_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."vehicle_issue_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "doc_renewal_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"renewal_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"doc" "renewal_doc" NOT NULL,
	"new_expiry" date NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"label" text NOT NULL,
	"mileage_km" integer DEFAULT 0 NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_change_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"driver_id" uuid NOT NULL,
	"reason" "vehicle_change_reason" NOT NULL,
	"new_vehicle" jsonb NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_issue_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"type" "vehicle_issue_type" NOT NULL,
	"severity" "vehicle_issue_severity" NOT NULL,
	"description" text NOT NULL,
	"status" "vehicle_issue_status" DEFAULT 'reported' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "work_prefs" jsonb;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "location_sharing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "mileage_km" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "next_maintenance_at" date;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "condition" jsonb;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "photo_file_id" uuid;--> statement-breakpoint
ALTER TABLE "doc_renewal_files" ADD CONSTRAINT "doc_renewal_files_renewal_id_doc_renewals_id_fk" FOREIGN KEY ("renewal_id") REFERENCES "public"."doc_renewals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_renewal_files" ADD CONSTRAINT "doc_renewal_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_renewals" ADD CONSTRAINT "doc_renewals_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_renewals" ADD CONSTRAINT "doc_renewals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_renewals" ADD CONSTRAINT "doc_renewals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_entries" ADD CONSTRAINT "maintenance_entries_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_change_files" ADD CONSTRAINT "vehicle_change_files_request_id_vehicle_change_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."vehicle_change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_change_files" ADD CONSTRAINT "vehicle_change_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_change_requests" ADD CONSTRAINT "vehicle_change_requests_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_change_requests" ADD CONSTRAINT "vehicle_change_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_issue_photos" ADD CONSTRAINT "vehicle_issue_photos_issue_id_vehicle_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."vehicle_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_issue_photos" ADD CONSTRAINT "vehicle_issue_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_issues" ADD CONSTRAINT "vehicle_issues_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_issues" ADD CONSTRAINT "vehicle_issues_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doc_renewal_files_renewal_idx" ON "doc_renewal_files" USING btree ("renewal_id");--> statement-breakpoint
CREATE INDEX "doc_renewal_files_file_idx" ON "doc_renewal_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "doc_renewals_driver_idx" ON "doc_renewals" USING btree ("driver_id","created_at");--> statement-breakpoint
CREATE INDEX "doc_renewals_vehicle_idx" ON "doc_renewals" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "doc_renewals_status_idx" ON "doc_renewals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "doc_renewals_decided_by_idx" ON "doc_renewals" USING btree ("decided_by");--> statement-breakpoint
CREATE INDEX "maintenance_entries_vehicle_idx" ON "maintenance_entries" USING btree ("vehicle_id","done_at");--> statement-breakpoint
CREATE INDEX "vehicle_change_files_request_idx" ON "vehicle_change_files" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "vehicle_change_files_file_idx" ON "vehicle_change_files" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_change_requests_reference_key" ON "vehicle_change_requests" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "vehicle_change_requests_driver_idx" ON "vehicle_change_requests" USING btree ("driver_id","created_at");--> statement-breakpoint
CREATE INDEX "vehicle_change_requests_decided_by_idx" ON "vehicle_change_requests" USING btree ("decided_by");--> statement-breakpoint
CREATE INDEX "vehicle_issue_photos_issue_idx" ON "vehicle_issue_photos" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "vehicle_issue_photos_file_idx" ON "vehicle_issue_photos" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_issues_reference_key" ON "vehicle_issues" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "vehicle_issues_vehicle_idx" ON "vehicle_issues" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_issues_driver_idx" ON "vehicle_issues" USING btree ("driver_id","created_at");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_photo_file_id_files_id_fk" FOREIGN KEY ("photo_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicles_photo_idx" ON "vehicles" USING btree ("photo_file_id");--> statement-breakpoint
ALTER TABLE "doc_renewals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "doc_renewal_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "maintenance_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_change_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_change_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_issue_photos" ENABLE ROW LEVEL SECURITY;
