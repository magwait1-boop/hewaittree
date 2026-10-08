-- Migration: Reload PostgREST schema cache to expose fam_requests table
-- Fixes: "Could not find the table 'public.fam_requests' in the schema cache"

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
