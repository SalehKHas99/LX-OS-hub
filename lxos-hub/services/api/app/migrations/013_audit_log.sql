create table if not exists audit_log (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references organizations(id) on delete cascade,
    actor_id uuid references users(id),
    action text not null,
    resource_type text,
    resource_id text,
    payload jsonb,
    created_at timestamptz default now()
);

create index if not exists idx_audit_log_org_id on audit_log(org_id, created_at desc);
