-- ══════════════════════════════════════════════════════════════
-- Migration 022: Theme system + image uploads
-- ══════════════════════════════════════════════════════════════

-- ── 1. Site-wide theme / branding config ─────────────────────
CREATE TABLE IF NOT EXISTS site_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT 'general',
  value_type TEXT NOT NULL DEFAULT 'text'
    CHECK (value_type IN ('text','color','font','number','boolean','url','select')),
  options TEXT[],          -- for select type: allowed values
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Saved named themes ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS themes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  tokens     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. User image uploads ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS uploads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id       UUID REFERENCES organizations(id) ON DELETE SET NULL,
  filename_original TEXT NOT NULL,
  filename_stored   TEXT NOT NULL UNIQUE,  -- hashed filename on disk
  mime_type    TEXT NOT NULL,
  size_bytes   INT  NOT NULL,
  sha256_hash  TEXT NOT NULL,              -- content hash (dedup)
  purpose      TEXT NOT NULL DEFAULT 'avatar'
               CHECK (purpose IN ('avatar','logo','banner','attachment')),
  url_path     TEXT NOT NULL,              -- public serving path
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploads_user   ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_hash   ON uploads(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_uploads_purpose ON uploads(purpose);

-- Link avatar to user
ALTER TABLE users ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL;

-- ── 4. Seed default site_config ──────────────────────────────
INSERT INTO site_config (key, value, label, group_name, value_type) VALUES
  ('site_name',        'LX-OS Hub',                        'Site Name',          'branding',    'text'),
  ('site_tagline',     'AI Prompt Engineering Workspace',   'Tagline',            'branding',    'text'),
  ('site_logo_url',    '',                                  'Logo URL',           'branding',    'url'),
  ('nav_show_feed',    'true',                              'Show Feed in Nav',   'navigation',  'boolean'),
  ('nav_show_library', 'true',                              'Show Library',       'navigation',  'boolean'),
  ('nav_show_lab',     'true',                              'Show Lab',           'navigation',  'boolean'),
  ('nav_show_bench',   'true',                              'Show Benchmarks',    'navigation',  'boolean'),
  ('nav_show_optimize','true',                              'Show Optimizer',     'navigation',  'boolean'),
  ('color_bg',         '#0c0e11',   'Background',          'theme_colors',  'color'),
  ('color_bg_panel',   '#12151a',   'Panel Background',    'theme_colors',  'color'),
  ('color_bg_elevated','#181c23',   'Elevated Background', 'theme_colors',  'color'),
  ('color_bg_hover',   '#1e2330',   'Hover Background',    'theme_colors',  'color'),
  ('color_border',     '#232a35',   'Border',              'theme_colors',  'color'),
  ('color_text',       '#e8eaf0',   'Text',                'theme_colors',  'color'),
  ('color_text_muted', '#6b7385',   'Muted Text',          'theme_colors',  'color'),
  ('color_text_dim',   '#3d4558',   'Dim Text',            'theme_colors',  'color'),
  ('color_accent',     '#5b8ff5',   'Accent',              'theme_colors',  'color'),
  ('color_green',      '#3ddba3',   'Success',             'theme_colors',  'color'),
  ('color_amber',      '#f5c543',   'Warning',             'theme_colors',  'color'),
  ('color_red',        '#f56b6b',   'Danger',              'theme_colors',  'color'),
  ('radius_sm',        '6px',       'Border Radius (sm)',  'theme_shape',   'text'),
  ('radius_md',        '10px',      'Border Radius (md)',  'theme_shape',   'text'),
  ('radius_lg',        '16px',      'Border Radius (lg)',  'theme_shape',   'text'),
  ('font_sans',        'Syne',      'Sans Font',           'theme_fonts',   'select'),
  ('font_mono',        'IBM Plex Mono', 'Mono Font',       'theme_fonts',   'select')
ON CONFLICT (key) DO NOTHING;

-- ── 5. Seed built-in themes ───────────────────────────────────
INSERT INTO themes (name, slug, is_default, is_builtin, tokens) VALUES
(
  'Dark Slate',
  'dark-slate',
  TRUE, TRUE,
  '{
    "color_bg":"#0c0e11","color_bg_panel":"#12151a","color_bg_elevated":"#181c23",
    "color_border":"#232a35","color_text":"#e8eaf0","color_text_muted":"#6b7385",
    "color_accent":"#5b8ff5","color_green":"#3ddba3","color_amber":"#f5c543","color_red":"#f56b6b",
    "font_sans":"Syne","font_mono":"IBM Plex Mono"
  }'::jsonb
),
(
  'Midnight Crimson',
  'midnight-crimson',
  FALSE, TRUE,
  '{
    "color_bg":"#0e0a0a","color_bg_panel":"#150f0f","color_bg_elevated":"#1c1414",
    "color_border":"#2d1e1e","color_text":"#f0e8e8","color_text_muted":"#7a5a5a",
    "color_accent":"#e05252","color_green":"#52c97a","color_amber":"#e8a030","color_red":"#ff6b6b",
    "font_sans":"Syne","font_mono":"IBM Plex Mono"
  }'::jsonb
),
(
  'Forest Terminal',
  'forest-terminal',
  FALSE, TRUE,
  '{
    "color_bg":"#080f0a","color_bg_panel":"#0d1610","color_bg_elevated":"#131e15",
    "color_border":"#1a2e1e","color_text":"#d0f0d8","color_text_muted":"#5a8a62",
    "color_accent":"#3ddb7a","color_green":"#3ddb7a","color_amber":"#d4c44a","color_red":"#db5252",
    "font_sans":"Syne","font_mono":"IBM Plex Mono"
  }'::jsonb
),
(
  'Arctic Light',
  'arctic-light',
  FALSE, TRUE,
  '{
    "color_bg":"#f7f8fb","color_bg_panel":"#ffffff","color_bg_elevated":"#eef0f5",
    "color_border":"#d8dde8","color_text":"#1a1d26","color_text_muted":"#6b7280",
    "color_accent":"#3b6ef5","color_green":"#16a870","color_amber":"#d97706","color_red":"#dc2626",
    "font_sans":"Syne","font_mono":"IBM Plex Mono"
  }'::jsonb
),
(
  'Void Purple',
  'void-purple',
  FALSE, TRUE,
  '{
    "color_bg":"#0a0812","color_bg_panel":"#100d1a","color_bg_elevated":"#161222",
    "color_border":"#241e35","color_text":"#e8e0f8","color_text_muted":"#6b5a85",
    "color_accent":"#9b6ef5","color_green":"#52c4a0","color_amber":"#e8c030","color_red":"#e05252",
    "font_sans":"Syne","font_mono":"IBM Plex Mono"
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
