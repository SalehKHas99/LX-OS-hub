-- Backfill aggregate_score for seeded prompts that have benchmark_runs
UPDATE prompts p
SET aggregate_score = COALESCE((
  SELECT MAX(br.aggregate_score)
  FROM benchmark_runs br
  JOIN prompt_versions pv ON pv.id = br.prompt_version_id
  WHERE pv.prompt_id = p.id AND br.status = 'succeeded'
), 0)
WHERE aggregate_score = 0;

-- Backfill avg_rating from ratings table
UPDATE prompts p
SET avg_rating = COALESCE((
  SELECT ROUND(AVG(rating)::numeric, 2)
  FROM ratings WHERE prompt_id = p.id
), 0)
WHERE avg_rating = 0;

-- Backfill fork_count from forks table
UPDATE prompts p
SET fork_count = (
  SELECT COUNT(*) FROM forks WHERE original_prompt_id = p.id
);

-- Ensure search_tsv is populated for all existing rows
UPDATE prompts SET search_tsv = to_tsvector('english',
  coalesce(title,'') || ' ' ||
  coalesce(description,'') || ' ' ||
  coalesce(category,'')
) WHERE search_tsv IS NULL;
