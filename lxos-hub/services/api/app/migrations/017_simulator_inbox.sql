create table if not exists simulator_receivers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete cascade,
  name        text,
  created_at  timestamptz default now()
);

create table if not exists simulator_inbox (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete cascade,
  receiver_id     uuid references simulator_receivers(id) on delete cascade,
  event_type      text,
  headers         jsonb,
  body            jsonb,
  sig_valid       boolean,
  received_at     timestamptz default now()
);
