-- Preserve storefronts that were already publicly accessible before explicit activation.
-- New Stores retain the existing NULL default and require their first explicit publish.
UPDATE stores SET settings_published_at = COALESCE(settings_published_at, created_at);
