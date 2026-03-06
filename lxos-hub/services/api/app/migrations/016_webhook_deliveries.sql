create table if not exists webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  webhook_id      uuid references webhooks(id) on delete cascade,
  outbox_id       uuid references event_outbox(id) on delete cascade,
  attempt_no      int not null default 1,
  status          text not null,
  http_status     int,
  error           text,
  response_ms     int,
  request_body    jsonb,
  response_body   text,
  created_at      timestamptz default now()
);
