-- Fix 1: runs.status — add 'refused' to allowed values
-- Postgres doesn't support ALTER CHECK directly; recreate constraint
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_status_check;
ALTER TABLE runs ADD CONSTRAINT runs_status_check
  CHECK (status IN ('queued','running','succeeded','failed','refused'));

-- Fix 2: runs — add compiled_prompt column (the filled-in prompt with inputs substituted)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS compiled_prompt TEXT;

-- Fix 3: prompt_embeddings table (pgvector optional — graceful if extension absent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    EXECUTE '
      CREATE TABLE IF NOT EXISTS prompt_embeddings (
        prompt_id UUID PRIMARY KEY REFERENCES prompts(id) ON DELETE CASCADE,
        embedding vector(1536),
        model TEXT NOT NULL DEFAULT ''text-embedding-3-small'',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    ';
  END IF;
END $$;

-- Fix 4: benchmarks — ensure it has a default status (some rows pre-migration may lack it)
ALTER TABLE benchmark_runs DROP CONSTRAINT IF EXISTS benchmark_runs_status_check;
ALTER TABLE benchmark_runs ADD CONSTRAINT benchmark_runs_status_check
  CHECK (status IN ('queued','running','succeeded','failed'));
