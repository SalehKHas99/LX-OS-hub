-- =============================================================
-- LX-OS Default Site Settings Seed
-- Run this ONCE in the Neon SQL editor after the first migration.
-- =============================================================

INSERT INTO site_settings (id, key, value, value_type, label, "group", is_public, created_at, updated_at)
VALUES
  -- Branding (exposed to frontend)
  (gen_random_uuid(), 'site_name',            'LX-OS',                       'string',  'Site Name',             'branding',    true,  now(), now()),
  (gen_random_uuid(), 'site_tagline',         'AI Art Prompt Marketplace',   'string',  'Site Tagline',          'branding',    true,  now(), now()),
  (gen_random_uuid(), 'logo_url',             '',                            'url',     'Logo URL',              'branding',    true,  now(), now()),
  (gen_random_uuid(), 'favicon_url',          '',                            'url',     'Favicon URL',           'branding',    true,  now(), now()),
  (gen_random_uuid(), 'primary_color',        '#6366f1',                     'color',   'Primary Color',         'branding',    true,  now(), now()),
  (gen_random_uuid(), 'accent_color',         '#a855f7',                     'color',   'Accent Color',          'branding',    true,  now(), now()),
  (gen_random_uuid(), 'footer_text',          '',                            'string',  'Footer Text',           'branding',    true,  now(), now()),

  -- Features (public — frontend checks these to show/hide UI)
  (gen_random_uuid(), 'context_lab_enabled',  'true',                        'boolean', 'Context Lab Enabled',   'features',    true,  now(), now()),
  (gen_random_uuid(), 'allow_registration',   'true',                        'boolean', 'Allow Registration',    'features',    false, now(), now()),

  -- Content (server-side)
  (gen_random_uuid(), 'max_images_per_prompt','5',                           'integer', 'Max Images Per Prompt', 'content',     false, now(), now()),

  -- Operations (server-side)
  (gen_random_uuid(), 'maintenance_mode',     'false',                       'boolean', 'Maintenance Mode',      'operations',  false, now(), now())

ON CONFLICT (key) DO NOTHING;
