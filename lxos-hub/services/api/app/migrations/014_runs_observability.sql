create table if not exists run_events (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references runs(id) on delete cascade,
    event_type text not null,
    payload jsonb,
    payload_hash text,
    prev_event_hash text,
    created_at timestamptz default now()
);

create index if not exists idx_run_events_run_id on run_events(run_id);
