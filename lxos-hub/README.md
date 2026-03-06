# LX-OS Hub

<div align="center">

**AI Prompt Engineering Workspace**

Build · Version · Benchmark · Optimize · Share auditable LX-DSL prompt systems

[![CI](https://github.com/YOUR_ORG/lxos-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/lxos-hub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PostgreSQL](https://img.shields.io/badge/DB-Neon%20PostgreSQL%2015-336791)](https://neon.tech)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](https://fastapi.tiangolo.com)

</div>

---

## What is LX-OS Hub?

LX-OS Hub is a full-stack platform for building, versioning, benchmarking, and publishing AI prompt systems using the **LX-DSL** prompt specification. Features:

- **Prompt Studio** — DSL editor with live lint, suggestions, and version control
- **Run Lab** — Execute prompt versions against any LLM with full observability
- **Benchmark Engine** — Score-card evaluation across 6 spec dimensions
- **Auto-Optimizer** — Variant generation + automatic promotion of best-scoring versions
- **Community Feed** — Share, fork, review, and rate prompts
- **Admin Dashboard** — Theme, branding, RBAC, audit log, webhooks
- **VS Code Extension** — Browse, run, and lint prompts natively in VS Code
- **Vocode Integration** — Voice-driven prompt execution via phone or WebRTC

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Database | PostgreSQL 15 (Neon) + pgvector + pg_trgm |
| Queue | Redis + RQ workers (Upstash) |
| Auth | DB session tokens + Google OAuth |
| Proxy | Nginx (production) |
| Voice | Vocode (phone/WebRTC agent) |
| IDE | VS Code native extension |

---

## Quick Start

```bash
git clone https://github.com/YOUR_ORG/lxos-hub.git
cd lxos-hub
cp .env.example .env          # fill in JWT_SECRET + WEBHOOK_SECRET
docker compose up --build
curl -X POST http://localhost:8000/demo/seed
# open http://localhost:3000
```

Full deployment guide: see [`integrations/neon/README.md`](integrations/neon/README.md) and the deployment playbook.

---

## Project Structure

```
lxos-hub/
├── .github/workflows/          # CI, deploy, Neon branch-per-PR
├── services/
│   ├── api/                    # FastAPI backend (70+ endpoints)
│   ├── web/                    # Next.js 14 frontend
│   └── nginx/                  # Production reverse proxy
├── extensions/vscode/          # VS Code extension
├── integrations/
│   ├── vocode/                 # Voice AI agent
│   └── neon/                   # Neon branch utilities
├── docker-compose.yml          # Dev
├── docker-compose.prod.yml     # Production
└── .env.example
```

---

## Integrations

- **Neon** → [`integrations/neon/README.md`](integrations/neon/README.md)
- **VS Code** → [`extensions/vscode/README.md`](extensions/vscode/README.md)
- **Vocode** → [`integrations/vocode/README.md`](integrations/vocode/README.md)

---

## License

MIT — see [LICENSE](LICENSE)
