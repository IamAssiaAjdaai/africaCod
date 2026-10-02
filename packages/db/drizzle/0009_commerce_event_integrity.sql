CREATE TRIGGER commerce_events_immutable BEFORE UPDATE ON commerce_events FOR EACH ROW EXECUTE FUNCTION protect_operational_history();
--> statement-breakpoint
CREATE FUNCTION require_commerce_event_store() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id=NEW.order_id AND o.organization_id=NEW.organization_id AND o.store_id=NEW.store_id) THEN RAISE EXCEPTION 'Commerce event must belong to order store'; END IF;
 RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER commerce_event_store BEFORE INSERT ON commerce_events FOR EACH ROW EXECUTE FUNCTION require_commerce_event_store();
--> statement-breakpoint
ALTER TABLE tracking_connections DROP CONSTRAINT tracking_provider_valid;
--> statement-breakpoint
ALTER TABLE tracking_connections ADD CONSTRAINT tracking_provider_valid CHECK (provider IN ('meta','tiktok','google-ads','google-sheets') AND mode IN ('mock','browser','blocked','production'));
