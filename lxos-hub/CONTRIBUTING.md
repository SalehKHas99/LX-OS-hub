# Contributing to LX-OS Hub

## Development Setup

```bash
git clone https://github.com/YOUR_ORG/lxos-hub
cd lxos-hub
cp .env.example .env
# Add your JWT_SECRET and WEBHOOK_SECRET
docker compose up --build
```

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production — auto-deploys on push |
| `staging` | Pre-production testing |
| `feat/*` | Feature branches — open PR against `main` |
| `fix/*` | Bug fixes |

## Pull Requests

Every PR automatically gets:
- An isolated **Neon database branch** (created on open, deleted on merge/close)
- CI checks: Python lint + type check, Next.js build, migration dry-run

**PR checklist:**
- [ ] `DEMO_MODE` is never set to `true` in production config
- [ ] No secrets committed (check `.gitignore`)
- [ ] Migrations are additive (no column drops without a fallback migration)
- [ ] New API endpoints have RBAC guards (`require_role` / `require_scope`)
- [ ] New frontend pages use `Shell` component

## Migration Guidelines

- One concern per file
- Filename: `NNN_snake_case_description.sql`
- Always idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Never drop columns or tables in the same migration as schema changes
- Test against the Neon staging branch before merging

## Code Style

**Python:** PEP8, type hints preferred, no bare `except:`
**TypeScript:** strict mode, no `any` except in legacy API response parsing
**SQL:** lowercase keywords, snake_case identifiers
