-- Fix RLS policies on fam_nodes (ensure public anon access for all operations)
ALTER TABLE public.fam_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_fam_nodes" ON public.fam_nodes;
CREATE POLICY "public_read_fam_nodes"
  ON public.fam_nodes
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "public_write_fam_nodes" ON public.fam_nodes;
CREATE POLICY "public_write_fam_nodes"
  ON public.fam_nodes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- App settings table — stores shared tree settings visible to all devices
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_app_settings" ON public.app_settings;
CREATE POLICY "public_read_app_settings"
  ON public.app_settings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "public_write_app_settings" ON public.app_settings;
CREATE POLICY "public_write_app_settings"
  ON public.app_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
