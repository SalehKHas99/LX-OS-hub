-- Ensure runs has org_id index
create index if not exists idx_runs_org_id on runs(org_id);
create index if not exists idx_prompts_org_id on prompts(org_id);
create index if not exists idx_prompt_versions_prompt_id on prompt_versions(prompt_id);
