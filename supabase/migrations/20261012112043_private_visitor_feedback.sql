-- Private visitor suggestions. Legacy localStorage tree roles are deliberately
-- not used: only Supabase Auth users explicitly listed here may read messages.
CREATE TABLE public.feedback_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_admins ENABLE ROW LEVEL SECURITY;

-- Override possible project-wide default grants. Membership can only be
-- managed by a trusted database owner/service role through server-side tools.
REVOKE ALL ON public.feedback_admins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feedback_admins TO authenticated;
GRANT ALL ON public.feedback_admins TO service_role;

CREATE POLICY feedback_admins_read_own_membership
  ON public.feedback_admins FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.visitor_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (
    name = btrim(name) AND char_length(name) BETWEEN 2 AND 100
    AND name !~ '[[:cntrl:]]'
  ),
  phone text NOT NULL CHECK (phone ~ '^\+?[0-9]{7,15}$'),
  message text NOT NULL CHECK (
    message = btrim(message) AND char_length(message) BETWEEN 5 AND 4000
  ),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visitor_feedback_created_at_idx ON public.visitor_feedback (created_at DESC, id DESC);

ALTER TABLE public.visitor_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.visitor_feedback FROM PUBLIC, anon, authenticated;
-- Visitors cannot read messages or override IDs, timestamps or review status.
GRANT INSERT (name, phone, message) ON public.visitor_feedback TO anon, authenticated;
GRANT SELECT ON public.visitor_feedback TO authenticated;
GRANT UPDATE (status) ON public.visitor_feedback TO authenticated;
GRANT ALL ON public.visitor_feedback TO service_role;

CREATE POLICY visitor_feedback_submit
  ON public.visitor_feedback FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new');

CREATE POLICY visitor_feedback_admin_read
  ON public.visitor_feedback FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY visitor_feedback_admin_review
  ON public.visitor_feedback FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback_admins
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.feedback_admins
      WHERE user_id = (SELECT auth.uid())
    )
  );

COMMENT ON TABLE public.visitor_feedback IS 'Private visitor suggestions; visitor INSERT only, allowlisted Supabase Auth admins SELECT and status UPDATE.';
COMMENT ON TABLE public.feedback_admins IS 'Trusted allowlist for the private inbox; manage only from Supabase SQL Editor or trusted server-side administration.';

NOTIFY pgrst, 'reload schema';
