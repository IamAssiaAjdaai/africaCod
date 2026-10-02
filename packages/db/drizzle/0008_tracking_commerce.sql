CREATE TABLE "commerce_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "commerce_event_identity" UNIQUE("id","store_id","organization_id"),
	CONSTRAINT "commerce_event_type" CHECK ("commerce_events"."type" IN ('product_viewed','checkout_submitted','order_created','order_confirmed','shipment_created','shipment_shipped','shipment_out_for_delivery','shipment_delivered','shipment_refused','shipment_returned','shipment_changed'))
);
--> statement-breakpoint
CREATE TABLE "sheets_test_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"columns" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sheets_row_mapping" UNIQUE("connection_id","order_number")
);
--> statement-breakpoint
CREATE TABLE "tracking_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"success" boolean,
	"safe_error" text
);
--> statement-breakpoint
CREATE TABLE "tracking_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"mode" text NOT NULL,
	"settings" jsonb NOT NULL,
	"secret_encrypted" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_store_provider_unique" UNIQUE("store_id","provider"),
	CONSTRAINT "tracking_identity_unique" UNIQUE("id","store_id","organization_id"),
	CONSTRAINT "tracking_provider_valid" CHECK ("tracking_connections"."provider" IN ('meta','tiktok','google-ads','google-sheets') AND "tracking_connections"."mode" IN ('mock','browser','blocked','production'))
);
--> statement-breakpoint
CREATE TABLE "tracking_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"safe_error" text,
	CONSTRAINT "tracking_job_dedupe" UNIQUE("connection_id","event_id"),
	CONSTRAINT "tracking_job_status" CHECK ("tracking_jobs"."status" IN ('pending','processing','done','failed','skipped'))
);
--> statement-breakpoint
CREATE TABLE "tracking_test_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_receipt_dedupe" UNIQUE("connection_id","event_id")
);
--> statement-breakpoint
ALTER TABLE "commerce_events" ADD CONSTRAINT "commerce_events_store_id_organization_id_stores_id_organization_id_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_events" ADD CONSTRAINT "commerce_events_order_id_organization_id_orders_id_organization_id_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets_test_rows" ADD CONSTRAINT "sheets_test_rows_connection_id_tracking_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."tracking_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_attempts" ADD CONSTRAINT "tracking_attempts_job_id_tracking_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."tracking_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_connections" ADD CONSTRAINT "tracking_connections_store_id_organization_id_stores_id_organization_id_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_jobs" ADD CONSTRAINT "tracking_jobs_connection_id_store_id_organization_id_tracking_connections_id_store_id_organization_id_fk" FOREIGN KEY ("connection_id","store_id","organization_id") REFERENCES "public"."tracking_connections"("id","store_id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_jobs" ADD CONSTRAINT "tracking_jobs_event_id_store_id_organization_id_commerce_events_id_store_id_organization_id_fk" FOREIGN KEY ("event_id","store_id","organization_id") REFERENCES "public"."commerce_events"("id","store_id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_test_receipts" ADD CONSTRAINT "tracking_test_receipts_connection_id_tracking_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."tracking_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tracking_job_due" ON "tracking_jobs" USING btree ("status","available_at");