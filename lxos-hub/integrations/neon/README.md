# LX-OS Hub — Neon Integration

Neon provides the PostgreSQL 15 database for LX-OS Hub with serverless scaling, instant schema branching, and built-in pgvector for semantic search.

## Initial Setup

### 1. Create Project

```
https://console.neon.tech → New Project
Name: lxos-hub
Region: us-east-2 (or closest to your backend)
PostgreSQL: 15
```

### 2. Enable Extensions (run in Neon SQL Editor)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- UUID generation (REQUIRED)
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- Fuzzy text search (REQUIRED)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID helpers
CREATE EXTENSION IF NOT EXISTS vector;       -- Semantic search (optional)
```

### 3. Get Connection Strings

**Always use the POOLER endpoint for `DATABASE_URL`** — it handles thousands of concurrent connections via PgBouncer.

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

### 4. Run Migrations

```bash
docker compose run --rm api python -m app.migrate
```

## Branch Strategy

| Branch | Connects to | Used by |
|---|---|---|
| `main` | Production DB | Production VPS / Railway |
| `staging` | Staging DB | Staging deploy, smoke tests |
| `pr-NNN` | Isolated PR DB | Created automatically per PR |

## CI — Branch per PR

The `.github/workflows/neon-branch.yml` workflow:
- **Creates** a `pr-NNN` Neon branch when a PR is opened
- **Runs all migrations** against the branch
- **Posts** the branch URL as a PR comment
- **Deletes** the branch when the PR closes

### Required GitHub Secrets

```
NEON_PROJECT_ID   = your project ID from Neon Dashboard
NEON_API_KEY      = personal access token from Neon Console → Account → API Keys
JWT_SECRET        = (your production JWT secret)
WEBHOOK_SECRET    = (your production webhook secret)
```

## Staging Branch

```bash
# Create staging branch (one time)
neon branches create --project-id YOUR_PROJECT_ID --name staging --parent main

# Get staging connection string
neon branches get staging --project-id YOUR_PROJECT_ID --output json | jq '.connection_uri'
```

## Scaling

| Tier | Size | Auto-suspend | Cost |
|---|---|---|---|
| Free | 3 GB | Yes (5 min idle) | $0/mo |
| Scale | 10 GB | No | $19/mo |
| Pro | Custom | Configurable | From $69/mo |

**Recommendation:** Use the **Scale** plan ($19/mo) for production — auto-suspend causes cold-start latency for the first request after idle.

## Backup

```bash
# Point-in-time export via pg_dump (use direct URL, not pooler)
pg_dump 'postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require' \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

Neon also retains 7 days of point-in-time restore history on paid plans.

## pgvector (Semantic Search)

Enable the `vector` extension and uncomment the `prompt_embeddings` table in migration 022 to enable semantic similarity search across prompts.

Requires: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to generate embeddings.
