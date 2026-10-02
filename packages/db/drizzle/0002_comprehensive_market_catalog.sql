ALTER TABLE "country_definitions" ALTER COLUMN "calling_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "store_markets" ALTER COLUMN "country_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "store_markets" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "store_markets" ADD COLUMN "custom_key" text;--> statement-breakpoint
ALTER TABLE "store_markets" ADD COLUMN "calling_code" text;--> statement-breakpoint
UPDATE "store_markets" AS market SET "name" = country."name", "calling_code" = country."calling_code" FROM "country_definitions" AS country WHERE market."country_code" = country."code";--> statement-breakpoint
ALTER TABLE "store_markets" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "country_definitions" DROP COLUMN "active";--> statement-breakpoint
ALTER TABLE "store_markets" ADD CONSTRAINT "market_store_custom_unique" UNIQUE("store_id","custom_key");--> statement-breakpoint
ALTER TABLE "store_markets" ADD CONSTRAINT "market_identity_check" CHECK (("store_markets"."country_code" IS NOT NULL AND "store_markets"."custom_key" IS NULL) OR ("store_markets"."country_code" IS NULL AND "store_markets"."custom_key" IS NOT NULL AND length("store_markets"."custom_key") > 0));