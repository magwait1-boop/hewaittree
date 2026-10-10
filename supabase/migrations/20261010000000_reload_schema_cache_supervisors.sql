-- Refresh the Data API schema cache after creating public.supervisors.
-- Run in the configured Supabase project's SQL Editor if requests return PGRST205.
NOTIFY pgrst, 'reload schema';
