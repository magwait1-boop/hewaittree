-- Force PostgREST to reload its schema cache so it recognises public.fam_nodes
-- This resolves: "Could not find the table 'public.fam_nodes' in the schema cache"

-- Add a harmless comment to the table so Supabase detects a schema change
COMMENT ON TABLE public.fam_nodes IS 'Family tree person nodes – shared across all devices';

-- Notify PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
