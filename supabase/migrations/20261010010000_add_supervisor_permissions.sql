-- Preserve existing accounts and assign the requested supervisor defaults.
ALTER TABLE public.supervisors
  ADD COLUMN IF NOT EXISTS can_edit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_delete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_moderate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_style boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
