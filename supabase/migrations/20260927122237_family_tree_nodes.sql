-- Family Tree Nodes Table
-- Stores all person records globally so all devices see the same data

CREATE TABLE IF NOT EXISTS public.fam_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  mother_name TEXT,
  father_id TEXT NOT NULL DEFAULT '',
  father_name TEXT,
  branch TEXT NOT NULL DEFAULT '',
  birth_date TEXT,
  death_date TEXT,
  leaf_color TEXT,
  edge_color TEXT,
  node_scale NUMERIC,
  manual_x NUMERIC NOT NULL DEFAULT 0,
  manual_y NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  card_bg_color TEXT,
  card_text_color TEXT,
  card_width NUMERIC,
  card_height NUMERIC,
  card_font_size NUMERIC,
  card_border_color TEXT,
  card_border_width NUMERIC,
  card_border_radius NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fam_nodes_father_id ON public.fam_nodes(father_id);
CREATE INDEX IF NOT EXISTS idx_fam_nodes_branch ON public.fam_nodes(branch);

-- Enable RLS
ALTER TABLE public.fam_nodes ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view the family tree)
DROP POLICY IF EXISTS "public_read_fam_nodes" ON public.fam_nodes;
CREATE POLICY "public_read_fam_nodes"
  ON public.fam_nodes
  FOR SELECT
  TO public
  USING (true);

-- Public write access (admins/supervisors identified at app level, not DB level)
DROP POLICY IF EXISTS "public_write_fam_nodes" ON public.fam_nodes;
CREATE POLICY "public_write_fam_nodes"
  ON public.fam_nodes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
