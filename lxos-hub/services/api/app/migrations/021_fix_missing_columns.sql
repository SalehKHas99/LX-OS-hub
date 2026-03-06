-- ── Fix 1: prompt_versions missing org_id ─────────────────────
ALTER TABLE prompt_versions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill org_id from parent prompt
UPDATE prompt_versions pv
SET org_id = p.org_id
FROM prompts p WHERE p.id = pv.prompt_id AND pv.org_id IS NULL;

-- ── Fix 2: runs missing model_config ──────────────────────────
ALTER TABLE runs ADD COLUMN IF NOT EXISTS model_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS compiled_prompt TEXT;

-- ── Fix 3: users — auth columns ───────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email'
  CHECK (auth_provider IN ('email', 'google', 'demo'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill: existing demo user is email_verified
UPDATE users SET email_verified = TRUE, auth_provider = 'demo' WHERE email = 'demo@lxos.local';

-- ── Fix 4: auth sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

-- ── Fix 5: password reset tokens ──────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Fix 6: social feed — posts ────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 2000),
  post_type TEXT NOT NULL DEFAULT 'share'
    CHECK (post_type IN ('share', 'review', 'question', 'showcase')),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_org ON posts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_prompt ON posts(prompt_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);

-- ── Fix 7: post comments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 1000),
  like_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at);

-- ── Fix 8: post likes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comment_likes (
  comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

-- Trigger: keep post like_count in sync
CREATE OR REPLACE FUNCTION update_post_like_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_like_count_trigger ON post_likes;
CREATE TRIGGER post_like_count_trigger
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_like_count();

-- Trigger: keep post comment_count in sync
CREATE OR REPLACE FUNCTION update_post_comment_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_comment_count_trigger ON post_comments;
CREATE TRIGGER post_comment_count_trigger
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();
