-- Create app_settings table for cross-device settings sync
-- This migration creates the missing app_settings table that was referenced
-- in famNodeService.ts but never applied to the database.

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
