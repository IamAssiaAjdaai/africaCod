ALTER TABLE "organization_memberships" DROP CONSTRAINT "membership_user_unique";--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "organization_memberships" USING btree ("user_id");