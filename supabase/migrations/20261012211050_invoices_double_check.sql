ALTER TABLE "invoices" ADD COLUMN "content" jsonb;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "paid_by" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payouts_approved_by_idx" ON "payouts" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "refunds_paid_by_idx" ON "refunds" USING btree ("paid_by");