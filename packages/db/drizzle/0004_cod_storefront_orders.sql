ALTER TABLE "product_market_offers" ADD CONSTRAINT "offer_identity_unique" UNIQUE("id","product_id","store_market_id","store_id","organization_id");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variant_id_product_org_unique" UNIQUE("id","product_id","organization_id");--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."product_page_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"normalized_phone" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_store_phone_unique" UNIQUE("store_id","normalized_phone"),
	CONSTRAINT "customer_identity_unique" UNIQUE("id","store_id","organization_id"),
	CONSTRAINT "customer_e164" CHECK ("customers"."normalized_phone" ~ '^[+][1-9][0-9]{6,14}$')
);
--> statement-breakpoint
CREATE TABLE "order_attribution" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"fbclid" text,
	"fbp" text,
	"fbc" text,
	"referrer" text,
	"landing_url" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"store_market_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"offer_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"variant_name" text,
	"sku" text,
	"currency" varchar(3) NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"unit_cost_minor" bigint,
	"quantity" integer NOT NULL,
	"line_total_minor" bigint NOT NULL,
	CONSTRAINT "item_money_valid" CHECK ("order_items"."quantity" BETWEEN 1 AND 20 AND "order_items"."unit_price_minor" > 0 AND ("order_items"."unit_cost_minor" IS NULL OR "order_items"."unit_cost_minor" >= 0) AND "order_items"."line_total_minor" = "order_items"."unit_price_minor" * "order_items"."quantity" AND "order_items"."line_total_minor" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"store_market_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_number" varchar(40) NOT NULL,
	"checkout_idempotency_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"country_code" varchar(2),
	"market_name" text NOT NULL,
	"currency" varchar(3) NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"region" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"shipping_fee_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"order_status" "order_status" DEFAULT 'new' NOT NULL,
	"duplicate_signal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "order_store_idempotency_unique" UNIQUE("store_id","checkout_idempotency_key"),
	CONSTRAINT "order_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "order_identity_unique" UNIQUE("id","store_id","store_market_id","organization_id","currency"),
	CONSTRAINT "order_money_valid" CHECK ("orders"."subtotal_minor" > 0 AND "orders"."shipping_fee_minor" >= 0 AND "orders"."total_minor" = "orders"."subtotal_minor" + "orders"."shipping_fee_minor" AND "orders"."total_minor" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "product_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"template_key" text DEFAULT 'cod_v1' NOT NULL,
	"status" "product_page_status" DEFAULT 'draft' NOT NULL,
	"draft_config" jsonb NOT NULL,
	"published_config" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_pages_product_id_unique" UNIQUE("product_id"),
	CONSTRAINT "page_template_valid" CHECK ("product_pages"."template_key" = 'cod_v1'),
	CONSTRAINT "published_page_has_content" CHECK ("product_pages"."status" <> 'published' OR ("product_pages"."published_config" IS NOT NULL AND "product_pages"."published_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "store_markets" ADD COLUMN "checkout_config" jsonb;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customer_store_tenant_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_attribution" ADD CONSTRAINT "attribution_order_tenant_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "event_order_tenant_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."orders"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "item_order_identity_fk" FOREIGN KEY ("order_id","store_id","store_market_id","organization_id","currency") REFERENCES "public"."orders"("id","store_id","store_market_id","organization_id","currency") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "item_product_store_fk" FOREIGN KEY ("product_id","store_id","organization_id") REFERENCES "public"."products"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "item_variant_product_fk" FOREIGN KEY ("variant_id","product_id","organization_id") REFERENCES "public"."product_variants"("id","product_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "item_offer_identity_fk" FOREIGN KEY ("offer_id","product_id","store_market_id","store_id","organization_id") REFERENCES "public"."product_market_offers"("id","product_id","store_market_id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_market_store_tenant_fk" FOREIGN KEY ("store_market_id","store_id","organization_id") REFERENCES "public"."store_markets"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_customer_store_tenant_fk" FOREIGN KEY ("customer_id","store_id","organization_id") REFERENCES "public"."customers"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_pages" ADD CONSTRAINT "page_product_tenant_fk" FOREIGN KEY ("product_id","organization_id") REFERENCES "public"."products"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_org_date_idx" ON "orders" USING btree ("organization_id","created_at");--> statement-breakpoint
