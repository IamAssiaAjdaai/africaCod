CREATE TYPE "public"."content_page_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "content_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"status" "content_page_status" DEFAULT 'draft' NOT NULL,
	"draft_content" text DEFAULT '' NOT NULL,
	"published_content" jsonb,
	"published_slug" varchar(100),
	"meta_title" varchar(200),
	"meta_description" varchar(500),
	"show_in_navigation" boolean DEFAULT false NOT NULL,
	"navigation_label" varchar(60),
	"navigation_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_page_store_slug_unique" UNIQUE("store_id","slug"),
	CONSTRAINT "content_page_published_slug_unique" UNIQUE("store_id","published_slug"),
	CONSTRAINT "content_page_published_snapshot_check" CHECK ("content_pages"."status" <> 'published' OR ("content_pages"."published_content" IS NOT NULL AND "content_pages"."published_slug" IS NOT NULL AND "content_pages"."published_at" IS NOT NULL)),
	CONSTRAINT "content_page_navigation_order_check" CHECK ("content_pages"."navigation_order" BETWEEN 0 AND 1000)
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "tagline" varchar(200);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "contact_email" varchar(200);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "contact_phone" varchar(40);--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_page_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_page_org_idx" ON "content_pages" USING btree ("organization_id","store_id");