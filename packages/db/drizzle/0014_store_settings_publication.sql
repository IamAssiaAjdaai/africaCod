CREATE TABLE "store_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_assets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "store_asset_valid" CHECK (("store_assets"."bytes" IS NULL OR "store_assets"."bytes" BETWEEN 1 AND 10485760) AND "store_assets"."mime_type" IN ('image/png','image/jpeg','image/webp'))
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "custom_field_snapshots" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "whatsapp" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "draft_settings" jsonb DEFAULT '{"identity":{"name":null,"tagline":null,"contactEmail":null,"contactPhone":null,"logoLight":null,"logoDark":null,"favicon":null,"heroLight":null,"heroDark":null},"theme":{"header":"modern","mode":"light","color":"#147d64","font":"geist"},"announcement":{"enabled":false,"text":"","link":null,"background":"#173d33","color":"#ffffff"},"hero":{"enabled":false,"title":"","subtitle":"","ctaLabel":"","ctaUrl":null},"featured":{"enabled":false,"title":"Featured products","mode":"all","categoryId":null,"productIds":[]},"productPage":{"mode":"inline","sticky":true,"quantity":true,"trustBadges":false,"buttonLabel":null,"buttonBackground":null,"buttonColor":null,"fields":[{"id":"name","enabled":true,"required":true,"order":0},{"id":"phone","enabled":true,"required":true,"order":1},{"id":"region","enabled":true,"required":false,"order":2},{"id":"city","enabled":true,"required":false,"order":3},{"id":"address","enabled":true,"required":false,"order":4},{"id":"whatsapp","enabled":false,"required":false,"order":5},{"id":"notes","enabled":false,"required":false,"order":6}],"customFields":[],"badges":[]},"navigation":{"header":[],"footer":[],"cta":{"enabled":false,"label":"","target":{"kind":"products"}},"social":{"instagram":null,"tiktok":null,"facebook":null,"youtube":null}}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "published_settings" jsonb DEFAULT '{"identity":{"name":null,"tagline":null,"contactEmail":null,"contactPhone":null,"logoLight":null,"logoDark":null,"favicon":null,"heroLight":null,"heroDark":null},"theme":{"header":"modern","mode":"light","color":"#147d64","font":"geist"},"announcement":{"enabled":false,"text":"","link":null,"background":"#173d33","color":"#ffffff"},"hero":{"enabled":false,"title":"","subtitle":"","ctaLabel":"","ctaUrl":null},"featured":{"enabled":false,"title":"Featured products","mode":"all","categoryId":null,"productIds":[]},"productPage":{"mode":"inline","sticky":true,"quantity":true,"trustBadges":false,"buttonLabel":null,"buttonBackground":null,"buttonColor":null,"fields":[{"id":"name","enabled":true,"required":true,"order":0},{"id":"phone","enabled":true,"required":true,"order":1},{"id":"region","enabled":true,"required":false,"order":2},{"id":"city","enabled":true,"required":false,"order":3},{"id":"address","enabled":true,"required":false,"order":4},{"id":"whatsapp","enabled":false,"required":false,"order":5},{"id":"notes","enabled":false,"required":false,"order":6}],"customFields":[],"badges":[]},"navigation":{"header":[],"footer":[],"cta":{"enabled":false,"label":"","target":{"kind":"products"}},"social":{"instagram":null,"tiktok":null,"facebook":null,"youtube":null}}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "settings_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "published_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "settings_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_assets" ADD CONSTRAINT "store_asset_tenant_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_assets_store_org_idx" ON "store_assets" USING btree ("store_id","organization_id");--> statement-breakpoint
CREATE INDEX "shipments_org_delivered_date_idx" ON "shipments" USING btree ("organization_id","delivered_at") WHERE "shipments"."shipment_status" = 'delivered';--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_custom_fields_bounded" CHECK (jsonb_typeof("orders"."custom_field_snapshots") = 'array' AND jsonb_array_length("orders"."custom_field_snapshots") <= 8);--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "store_settings_revisions_valid" CHECK ("stores"."settings_revision" >= 0 AND "stores"."published_revision" >= 0 AND "stores"."published_revision" <= "stores"."settings_revision");
--> statement-breakpoint
UPDATE stores SET draft_settings = jsonb_set(draft_settings, '{identity}', (draft_settings->'identity') || jsonb_build_object('name',name,'tagline',tagline,'contactEmail',contact_email,'contactPhone',contact_phone)), published_settings = jsonb_set(published_settings, '{identity}', (published_settings->'identity') || jsonb_build_object('name',name,'tagline',tagline,'contactEmail',contact_email,'contactPhone',contact_phone));

--> statement-breakpoint
INSERT INTO store_assets (organization_id,store_id,storage_key,mime_type) SELECT organization_id,id,logo, CASE WHEN logo LIKE '%.png' THEN 'image/png' WHEN logo LIKE '%.webp' THEN 'image/webp' ELSE 'image/jpeg' END FROM stores WHERE logo ~ '^[0-9a-f-]{36}\.(png|jpg|webp)$';
--> statement-breakpoint
UPDATE stores s SET draft_settings = jsonb_set(s.draft_settings,'{identity,logoLight}',to_jsonb(a.id::text)), published_settings = jsonb_set(s.published_settings,'{identity,logoLight}',to_jsonb(a.id::text)) FROM store_assets a WHERE a.store_id = s.id AND a.organization_id = s.organization_id AND a.storage_key = s.logo;
