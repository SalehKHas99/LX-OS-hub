-- =============================================================
-- LX-OS Full-Text Search Trigger
-- Run this ONCE in the Neon SQL editor after the first migration.
-- Keeps the search_vector column on prompts automatically updated.
-- =============================================================

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION update_prompt_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(NEW.raw_prompt, '')),  'B') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')),       'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Attach trigger to the prompts table
DROP TRIGGER IF EXISTS tsvector_update ON prompts;

CREATE TRIGGER tsvector_update
BEFORE INSERT OR UPDATE ON prompts
FOR EACH ROW EXECUTE FUNCTION update_prompt_search_vector();

-- Step 3: Backfill any existing rows (safe to run multiple times)
UPDATE prompts SET title = title;
