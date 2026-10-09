-- Migration: Create fam_requests table for supervisor → admin request flow
-- Replaces localStorage-only storage with persistent Supabase table

CREATE TABLE IF NOT EXISTS public.fam_requests (
  req_id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('add', 'edit', 'delete')),
  data JSONB,
  target_id TEXT,
  by_user TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fam_requests_status ON public.fam_requests (status);
CREATE INDEX IF NOT EXISTS idx_fam_requests_created_at ON public.fam_requests (created_at);

ALTER TABLE public.fam_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (app uses custom username/password auth, not Supabase auth)
DROP POLICY IF EXISTS "fam_requests_public_read" ON public.fam_requests;
CREATE POLICY "fam_requests_public_read"
  ON public.fam_requests
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "fam_requests_public_insert" ON public.fam_requests;
CREATE POLICY "fam_requests_public_insert"
  ON public.fam_requests
  FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "fam_requests_public_update" ON public.fam_requests;
CREATE POLICY "fam_requests_public_update"
  ON public.fam_requests
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "fam_requests_public_delete" ON public.fam_requests;
CREATE POLICY "fam_requests_public_delete"
  ON public.fam_requests
  FOR DELETE
  TO public
  USING (true);
