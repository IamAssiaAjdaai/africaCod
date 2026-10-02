ALTER TABLE "store_markets" ADD CONSTRAINT "markets_id_store_org_unique" UNIQUE("id","store_id","organization_id");--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"parent_id" uuid,
	"depth" integer DEFAULT 0 NOT NULL,
	"parent_depth" integer DEFAULT 0 NOT NULL,
	"status" "market_status" DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_store_slug_unique" UNIQUE("store_id","slug"),
	CONSTRAINT "category_identity_depth_unique" UNIQUE("id","store_id","organization_id","depth"),
	CONSTRAINT "category_parent_identity_unique" UNIQUE("id","parent_id","store_id","organization_id"),
	CONSTRAINT "category_two_levels" CHECK ("categories"."parent_depth" = 0 AND (("categories"."parent_id" IS NULL AND "categories"."depth" = 0) OR ("categories"."parent_id" IS NOT NULL AND "categories"."depth" = 1)))
);
--> statement-breakpoint
CREATE TABLE "product_market_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"store_market_id" uuid NOT NULL,
	"price_minor" bigint NOT NULL,
	"compare_at_price_minor" bigint,
	"cost_minor" bigint,
	"currency" varchar(3) NOT NULL,
	"status" "market_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_product_market_unique" UNIQUE("product_id","store_market_id"),
	CONSTRAINT "offer_money_valid" CHECK ("product_market_offers"."price_minor" > 0 AND "product_market_offers"."price_minor" <= 9007199254740991 AND ("product_market_offers"."compare_at_price_minor" IS NULL OR ("product_market_offers"."compare_at_price_minor" >= "product_market_offers"."price_minor" AND "product_market_offers"."compare_at_price_minor" <= 9007199254740991)) AND ("product_market_offers"."cost_minor" IS NULL OR ("product_market_offers"."cost_minor" >= 0 AND "product_market_offers"."cost_minor" <= 9007199254740991)))
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" text DEFAULT 'image' NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"alt_text" varchar(200),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_media_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_images_only" CHECK ("product_media"."type" = 'image' AND "product_media"."mime_type" IN ('image/png', 'image/jpeg', 'image/webp'))
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"sku" varchar(100),
	"status" "market_status" DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_product_sku_unique" UNIQUE("product_id","sku")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"sku" varchar(100),
	"short_description" varchar(160),
	"description" text,
	"category_id" uuid,
	"subcategory_id" uuid,
	"category_depth" integer DEFAULT 0 NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_store_slug_unique" UNIQUE("store_id","slug"),
	CONSTRAINT "product_store_sku_unique" UNIQUE("store_id","sku"),
	CONSTRAINT "product_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "product_id_store_org_unique" UNIQUE("id","store_id","organization_id"),
	CONSTRAINT "product_category_valid" CHECK ("products"."category_depth" = 0 AND ("products"."subcategory_id" IS NULL OR "products"."category_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "category_store_tenant_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "category_parent_top_level_fk" FOREIGN KEY ("parent_id","store_id","organization_id","parent_depth") REFERENCES "public"."categories"("id","store_id","organization_id","depth") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_market_offers" ADD CONSTRAINT "offer_product_store_tenant_fk" FOREIGN KEY ("product_id","store_id","organization_id") REFERENCES "public"."products"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_market_offers" ADD CONSTRAINT "offer_market_store_tenant_fk" FOREIGN KEY ("store_market_id","store_id","organization_id") REFERENCES "public"."store_markets"("id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "media_product_tenant_fk" FOREIGN KEY ("product_id","organization_id") REFERENCES "public"."products"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variant_product_tenant_fk" FOREIGN KEY ("product_id","organization_id") REFERENCES "public"."products"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "product_store_tenant_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "product_category_top_level_fk" FOREIGN KEY ("category_id","store_id","organization_id","category_depth") REFERENCES "public"."categories"("id","store_id","organization_id","depth") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "product_subcategory_parent_fk" FOREIGN KEY ("subcategory_id","category_id","store_id","organization_id") REFERENCES "public"."categories"("id","parent_id","store_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_org_store_idx" ON "categories" USING btree ("organization_id","store_id");--> statement-breakpoint
CREATE INDEX "offers_org_product_idx" ON "product_market_offers" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "media_org_product_idx" ON "product_media" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "variants_org_product_idx" ON "product_variants" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "products_org_store_idx" ON "products" USING btree ("organization_id","store_id");--> statement-breakpoint
