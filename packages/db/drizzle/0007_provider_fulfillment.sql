CREATE TABLE "provider_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"success" boolean,
	"safe_error" text,
	"response_identifier" text
);
--> statement-breakpoint
CREATE TABLE "provider_connection_markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"store_market_id" uuid NOT NULL,
	CONSTRAINT "provider_market_unique" UNIQUE("connection_id","store_market_id")
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"provider_key" text NOT NULL,
	"adapter_mode" text NOT NULL,
	"credentials_encrypted" text NOT NULL,
	"status" text DEFAULT 'not_connected' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"settings_json" jsonb NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_store_key_unique" UNIQUE("store_id","provider_key"),
	CONSTRAINT "provider_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "provider_identity_unique" UNIQUE("id","store_id","organization_id"),
	CONSTRAINT "provider_connection_values" CHECK ("provider_connections"."provider_key" = 'shipcod' AND "provider_connections"."adapter_mode" IN ('mock','production') AND "provider_connections"."status" IN ('not_connected','connected','error','disconnected'))
);
--> statement-breakpoint
CREATE TABLE "provider_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"connection_revision" integer NOT NULL,
	"order_id" uuid,
	"fulfillment_id" uuid,
	"shipment_id" uuid,
	"operation" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"snapshot" jsonb,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_jobs_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "provider_job_values" CHECK ("provider_jobs"."operation" IN ('validate','create','poll') AND "provider_jobs"."status" IN ('pending','processing','done','failed','investigation','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "provider_product_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"mapping_key" text NOT NULL,
	"provider_product_id" text,
	"provider_sku" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_mapping_unique" UNIQUE("connection_id","mapping_key"),
	CONSTRAINT "mapping_key_valid" CHECK ("provider_product_mappings"."mapping_key" = "provider_product_mappings"."product_id"::text || ':' || coalesce("provider_product_mappings"."variant_id"::text,'base') AND ("provider_product_mappings"."provider_product_id" IS NOT NULL OR "provider_product_mappings"."provider_sku" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "provider_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"raw_status" text NOT NULL,
	"normalized_status" "shipment_status",
	"disposition" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_event_dedupe" UNIQUE("connection_id","event_key")
);
--> statement-breakpoint
CREATE TABLE "provider_test_shipments" (
	"request_key" uuid PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"raw_status" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_test_shipments_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
ALTER TABLE "fulfillments" DROP CONSTRAINT "fulfillment_manual_mode";--> statement-breakpoint
ALTER TABLE "shipment_events" DROP CONSTRAINT "shipment_event_manual_source";--> statement-breakpoint
ALTER TABLE "shipments" DROP CONSTRAINT "manual_shipment_provider";--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "provider_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_raw_status" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "last_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "integration_error" text;--> statement-breakpoint
ALTER TABLE "provider_attempts" ADD CONSTRAINT "provider_attempts_job_id_provider_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."provider_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_attempts" ADD CONSTRAINT "attempt_provider_connection_fk" FOREIGN KEY ("connection_id","organization_id") REFERENCES "public"."provider_connections"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connection_markets" ADD CONSTRAINT "provider_market_connection_fk" FOREIGN KEY ("connection_id","store_id","organization_id") REFERENCES "public"."provider_connections"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connection_markets" ADD CONSTRAINT "provider_market_store_fk" FOREIGN KEY ("store_market_id","store_id","organization_id") REFERENCES "public"."store_markets"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_store_tenant_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_jobs" ADD CONSTRAINT "job_connection_tenant_fk" FOREIGN KEY ("connection_id","organization_id") REFERENCES "public"."provider_connections"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_jobs" ADD CONSTRAINT "job_fulfillment_identity_fk" FOREIGN KEY ("fulfillment_id","order_id","organization_id") REFERENCES "public"."fulfillments"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_jobs" ADD CONSTRAINT "job_shipment_tenant_fk" FOREIGN KEY ("shipment_id","organization_id") REFERENCES "public"."shipments"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_product_mappings" ADD CONSTRAINT "mapping_connection_store_fk" FOREIGN KEY ("connection_id","store_id","organization_id") REFERENCES "public"."provider_connections"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_product_mappings" ADD CONSTRAINT "mapping_product_store_fk" FOREIGN KEY ("product_id","store_id","organization_id") REFERENCES "public"."products"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_product_mappings" ADD CONSTRAINT "mapping_variant_product_fk" FOREIGN KEY ("variant_id","product_id","organization_id") REFERENCES "public"."product_variants"("id","product_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_status_events" ADD CONSTRAINT "raw_event_connection_tenant_fk" FOREIGN KEY ("connection_id","organization_id") REFERENCES "public"."provider_connections"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_status_events" ADD CONSTRAINT "raw_event_shipment_tenant_fk" FOREIGN KEY ("shipment_id","organization_id") REFERENCES "public"."shipments"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_test_shipments" ADD CONSTRAINT "provider_test_shipments_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_job_due_idx" ON "provider_jobs" USING btree ("status","available_at");--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillment_provider_tenant_fk" FOREIGN KEY ("provider_connection_id","organization_id") REFERENCES "public"."provider_connections"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipment_provider_tenant_fk" FOREIGN KEY ("provider_connection_id","organization_id") REFERENCES "public"."provider_connections"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipment_provider_external_unique" UNIQUE("provider_connection_id","provider_shipment_id");--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillment_manual_mode" CHECK (("fulfillments"."mode" = 'manual' AND "fulfillments"."provider_connection_id" IS NULL) OR ("fulfillments"."mode" = 'provider' AND "fulfillments"."provider_connection_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_event_manual_source" CHECK ("shipment_events"."source" IN ('manual','poll'));--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "manual_shipment_provider" CHECK (("shipments"."provider_key" = 'manual' AND "shipments"."provider_shipment_id" IS NULL AND "shipments"."provider_connection_id" IS NULL) OR ("shipments"."provider_key" = 'shipcod' AND "shipments"."provider_shipment_id" IS NOT NULL AND "shipments"."provider_connection_id" IS NOT NULL));
--> statement-breakpoint
CREATE TRIGGER provider_status_events_immutable BEFORE UPDATE ON provider_status_events FOR EACH ROW EXECUTE FUNCTION protect_operational_history();
--> statement-breakpoint
CREATE FUNCTION require_provider_store() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.provider_connection_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM provider_connections c JOIN orders o ON o.store_id=c.store_id AND o.organization_id=c.organization_id
 WHERE c.id=NEW.provider_connection_id AND o.id=NEW.order_id AND c.organization_id=NEW.organization_id
 ) THEN RAISE EXCEPTION 'Provider connection must belong to order store'; END IF;
 IF TG_TABLE_NAME='shipments' THEN
 IF NOT EXISTS (SELECT 1 FROM fulfillments f WHERE f.id=NEW.fulfillment_id AND f.provider_connection_id IS NOT DISTINCT FROM NEW.provider_connection_id) THEN RAISE EXCEPTION 'Shipment must match fulfillment provider'; END IF;
 END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER fulfillment_provider_store BEFORE INSERT OR UPDATE ON fulfillments FOR EACH ROW EXECUTE FUNCTION require_provider_store();
--> statement-breakpoint
CREATE TRIGGER shipment_provider_store BEFORE INSERT OR UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION require_provider_store();
