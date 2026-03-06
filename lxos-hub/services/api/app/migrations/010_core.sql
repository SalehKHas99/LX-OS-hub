create extension if not exists "pgcrypto";

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    username text,
    created_at timestamptz default now()
);

create table if not exists organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    created_at timestamptz default now()
);

create table if not exists prompts (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references organizations(id) on delete cascade,
    title text not null,
    description text,
    visibility text not null default 'private',
    license text,
    category text,
    tags text[],
    created_by uuid references users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists prompt_versions (
    id uuid primary key default gen_random_uuid(),
    prompt_id uuid not null references prompts(id) on delete cascade,
    version_num int not null default 1,
    commit_message text,
    dsl_yaml text,
    dsl_json jsonb,
    compiled_template text,
    created_by uuid references users(id),
    created_at timestamptz default now(),
    unique(prompt_id, version_num)
);

create table if not exists runs (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references organizations(id) on delete cascade,
    prompt_version_id uuid references prompt_versions(id),
    status text not null default 'queued',
    model text,
    inputs jsonb,
    output_text text,
    latency_ms int,
    tokens_in int,
    tokens_out int,
    cost_usd numeric(12,6),
    provider text,
    model_snapshot jsonb,
    safety_outcome text,
    output_hash text,
    request_id text,
    created_by uuid references users(id),
    created_at timestamptz default now(),
    finished_at timestamptz
);
