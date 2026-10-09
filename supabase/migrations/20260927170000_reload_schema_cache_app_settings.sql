-- Reload PostgREST schema cache so app_settings table is recognized
-- This resolves: "Could not find the table 'public.app_settings' in the schema cache"

-- Ensure app_settings table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they exist
DROP POLICY IF EXISTS "Allow public read" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public write" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public read and write" ON public.app_settings;

CREATE POLICY "Allow public read and write"
  ON public.app_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
