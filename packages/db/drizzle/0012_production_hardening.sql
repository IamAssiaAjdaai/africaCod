CREATE TABLE "oauth_states" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"verifier_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_positive" CHECK ("rate_limit_buckets"."count" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_attribution" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_store_tenant_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_expiry_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "rate_limit_expiry_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "provider_jobs" ADD CONSTRAINT "provider_job_identity_unique" UNIQUE("id","connection_id","organization_id");
--> statement-breakpoint
ALTER TABLE "provider_attempts" ADD CONSTRAINT "attempt_job_tenant_fk" FOREIGN KEY ("job_id","connection_id","organization_id") REFERENCES "public"."provider_jobs"("id","connection_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commerce_event_store_time_idx" ON "commerce_events" USING btree ("store_id","occurred_at");--> statement-breakpoint
CREATE INDEX "commerce_view_retention_idx" ON "commerce_events" USING btree ("occurred_at") WHERE "commerce_events"."type" = 'product_viewed';--> statement-breakpoint
CREATE INDEX "attempt_callback_due_idx" ON "confirmation_attempts" USING btree ("organization_id","next_callback_at") WHERE "confirmation_attempts"."next_callback_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "items_org_product_order_idx" ON "order_items" USING btree ("organization_id","product_id","order_id");--> statement-breakpoint
CREATE INDEX "orders_org_store_date_idx" ON "orders" USING btree ("organization_id","store_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_org_market_date_idx" ON "orders" USING btree ("organization_id","store_market_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_org_status_date_idx" ON "orders" USING btree ("organization_id","order_status","created_at");--> statement-breakpoint
CREATE INDEX "orders_store_phone_date_idx" ON "orders" USING btree ("store_id","phone","created_at");--> statement-breakpoint
CREATE INDEX "orders_org_agent_date_idx" ON "orders" USING btree ("organization_id","assigned_membership_id","created_at");--> statement-breakpoint
CREATE INDEX "provider_attempt_job_idx" ON "provider_attempts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "tracking_job_connection_idx" ON "tracking_jobs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "visitor_retention_idx" ON "visitor_events" USING btree ("occurred_at");--> statement-breakpoint
