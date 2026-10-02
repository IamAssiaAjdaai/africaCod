CREATE TABLE "visitor_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid,
	"market_token" varchar(120),
	"type" varchar(30) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_type_valid" CHECK ("visitor_events"."type" IN ('store_view','product_view','checkout_started')),
	CONSTRAINT "visitor_product_required" CHECK ("visitor_events"."type" = 'store_view' OR "visitor_events"."product_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_store_tenant_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_events" ADD CONSTRAINT "visitor_product_store_tenant_fk" FOREIGN KEY ("product_id","store_id","organization_id") REFERENCES "public"."products"("id","store_id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_store_time_idx" ON "visitor_events" USING btree ("organization_id","store_id","occurred_at");