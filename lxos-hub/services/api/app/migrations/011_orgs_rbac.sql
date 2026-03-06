create table if not exists memberships (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role text not null default 'viewer',
    created_at timestamptz default now(),
    unique(org_id, user_id)
);

create table if not exists api_keys (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references organizations(id) on delete cascade,
    name text,
    hashed_key text unique not null,
    subject_type text not null default 'user',
    subject_id uuid,
    scopes text[],
    created_at timestamptz default now(),
    revoked_at timestamptz
);
