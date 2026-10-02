ALTER TABLE "organization_memberships" ADD CONSTRAINT "membership_id_org_unique" UNIQUE("id","organization_id");--> statement-breakpoint
CREATE TYPE "public"."confirmation_outcome" AS ENUM('no_answer', 'callback', 'confirmed', 'cancelled', 'invalid_order');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_status" AS ENUM('pending', 'ready', 'processing', 'fulfilled', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('created', 'shipped', 'out_for_delivery', 'delivery_failed', 'delivered', 'refused', 'returned', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'confirmed' BEFORE 'cancelled';--> statement-breakpoint
CREATE TABLE "confirmation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"agent_membership_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"outcome" "confirmation_outcome" NOT NULL,
	"note" text,
	"next_callback_at" timestamp with time zone,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_order_request_unique" UNIQUE("order_id","request_key"),
	CONSTRAINT "callback_requires_time" CHECK ("confirmation_attempts"."outcome" <> 'callback' OR "confirmation_attempts"."next_callback_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "fulfillment_state_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"fulfillment_id" uuid NOT NULL,
	"from_status" "fulfillment_status",
	"to_status" "fulfillment_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "fulfillment_status" DEFAULT 'pending' NOT NULL,
	"mode" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "fulfillment_identity_unique" UNIQUE("id","order_id","organization_id"),
	CONSTRAINT "fulfillment_manual_mode" CHECK ("fulfillments"."mode" = 'manual')
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"from_status" "shipment_status",
	"to_status" "shipment_status" NOT NULL,
	"provider_status_raw" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_event_manual_source" CHECK ("shipment_events"."source" = 'manual')
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"fulfillment_id" uuid NOT NULL,
	"provider_key" text DEFAULT 'manual' NOT NULL,
	"provider_shipment_id" text,
	"tracking_number" text,
	"tracking_url" text,
	"shipment_status" "shipment_status" DEFAULT 'created' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "shipments_fulfillment_id_unique" UNIQUE("fulfillment_id"),
	CONSTRAINT "shipment_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "manual_shipment_provider" CHECK ("shipments"."provider_key" = 'manual' AND "shipments"."provider_shipment_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "assigned_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "confirmation_attempts" ADD CONSTRAINT "attempt_order_tenant_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmation_attempts" ADD CONSTRAINT "attempt_agent_tenant_fk" FOREIGN KEY ("agent_membership_id","organization_id") REFERENCES "public"."organization_memberships"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_state_events" ADD CONSTRAINT "fulfillment_event_identity_fk" FOREIGN KEY ("fulfillment_id","order_id","organization_id") REFERENCES "public"."fulfillments"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillment_order_tenant_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_event_tenant_fk" FOREIGN KEY ("shipment_id","organization_id") REFERENCES "public"."shipments"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipment_fulfillment_order_tenant_fk" FOREIGN KEY ("fulfillment_id","order_id","organization_id") REFERENCES "public"."fulfillments"("id","order_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_order_time_idx" ON "confirmation_attempts" USING btree ("order_id","attempted_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_assignment_tenant_fk" FOREIGN KEY ("assigned_membership_id","organization_id") REFERENCES "public"."organization_memberships"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
--> statement-breakpoint
-- Operational history is append-only. Deletion remains available to database administrators
-- for explicit retention/fixture cleanup; no application deletion API is exposed.
CREATE FUNCTION protect_operational_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Operational history cannot be updated' USING ERRCODE = '23514'; END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_confirmation_attempt BEFORE UPDATE ON confirmation_attempts FOR EACH ROW EXECUTE FUNCTION protect_operational_history();
--> statement-breakpoint
CREATE TRIGGER immutable_order_event BEFORE UPDATE ON order_events FOR EACH ROW EXECUTE FUNCTION protect_operational_history();
--> statement-breakpoint
CREATE TRIGGER immutable_fulfillment_event BEFORE UPDATE ON fulfillment_state_events FOR EACH ROW EXECUTE FUNCTION protect_operational_history();
--> statement-breakpoint
CREATE TRIGGER immutable_shipment_event BEFORE UPDATE ON shipment_events FOR EACH ROW EXECUTE FUNCTION protect_operational_history();
--> statement-breakpoint
CREATE FUNCTION require_confirmed_fulfillment_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM orders WHERE id=NEW.order_id AND organization_id=NEW.organization_id AND order_status::text='confirmed') THEN
 RAISE EXCEPTION 'Fulfillment and shipment require a confirmed order' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER fulfillment_confirmed_order BEFORE INSERT OR UPDATE ON fulfillments FOR EACH ROW EXECUTE FUNCTION require_confirmed_fulfillment_order();
--> statement-breakpoint
CREATE TRIGGER shipment_confirmed_order BEFORE INSERT OR UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION require_confirmed_fulfillment_order();
