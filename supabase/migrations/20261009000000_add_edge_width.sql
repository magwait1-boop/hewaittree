-- Persist per-connection thickness alongside the existing edge color.
ALTER TABLE public.fam_nodes
  ADD COLUMN IF NOT EXISTS edge_width NUMERIC;

NOTIFY pgrst, 'reload schema';
