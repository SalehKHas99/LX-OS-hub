create table if not exists webhooks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade,
  url         text not null,
  secret      text not null default encode(gen_random_bytes(32), 'hex'),
  events      text[],
  enabled     boolean not null default true,
  created_at  timestamptz default now()
);

create table if not exists event_outbox (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete cascade,
  event_type      text not null,
  payload         jsonb,
  status          text not null default 'pending',
  attempts        int not null default 0,
  next_retry_at   timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz default now()
);
