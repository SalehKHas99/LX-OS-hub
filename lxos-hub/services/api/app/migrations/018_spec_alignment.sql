-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tags table (normalized, replaces array column)
CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (prompt_id, tag)
);

-- Forks
CREATE TABLE IF NOT EXISTS forks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  fork_prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(original_prompt_id, fork_prompt_id)
);

-- Ratings
CREATE TABLE IF NOT EXISTS ratings (
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, user_id)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tool calls (integrity log)
CREATE TABLE IF NOT EXISTS tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  request JSONB NOT NULL,
  response JSONB,
  status TEXT NOT NULL CHECK (status IN ('ok','error','blocked')),
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Citations ledger
CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  url TEXT,
  snippet_hash TEXT,
  used_in_section TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suggestions (lint + optional LLM)
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  prompt_id UUID REFERENCES prompts(id),
  prompt_version_id UUID REFERENCES prompt_versions(id),
  mode TEXT NOT NULL CHECK (mode IN ('lint_only','lint_plus_llm')),
  goal TEXT,
  input_dsl_yaml TEXT NOT NULL,
  suggestions_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Benchmarks
CREATE TABLE IF NOT EXISTS benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_id UUID NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
  prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')) DEFAULT 'queued',
  results JSONB,
  aggregate_score NUMERIC(6,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- Optimization jobs
CREATE TABLE IF NOT EXISTS optimization_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  baseline_prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
  benchmark_id UUID NOT NULL REFERENCES benchmarks(id),
  objective TEXT NOT NULL DEFAULT 'maximize_score_under_budget',
  budget JSONB NOT NULL DEFAULT '{"max_variants":12,"max_total_runs":120}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')) DEFAULT 'queued',
  promoted_prompt_version_id UUID REFERENCES prompt_versions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS optimization_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  optimization_job_id UUID NOT NULL REFERENCES optimization_jobs(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  transform_set JSONB NOT NULL DEFAULT '[]'::jsonb,
  dsl_yaml TEXT NOT NULL,
  dsl_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  compiled_template TEXT NOT NULL,
  aggregate_score NUMERIC(6,4),
  results JSONB
);

-- Full-text search vector on prompts
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS fork_count INT NOT NULL DEFAULT 0;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS aggregate_score NUMERIC(6,4) DEFAULT 0;

CREATE INDEX IF NOT EXISTS prompts_tsv_idx ON prompts USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS prompts_title_trgm_idx ON prompts USING GIN (title gin_trgm_ops);

-- Trigger to keep search_tsv up to date
CREATE OR REPLACE FUNCTION prompts_search_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english',
    coalesce(NEW.title,'') || ' ' ||
    coalesce(NEW.description,'') || ' ' ||
    coalesce(NEW.category,'')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prompts_tsv_trigger ON prompts;
CREATE TRIGGER prompts_tsv_trigger
  BEFORE INSERT OR UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION prompts_search_tsv_update();

-- Backfill existing rows
UPDATE prompts SET search_tsv = to_tsvector('english',
  coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')
) WHERE search_tsv IS NULL;
