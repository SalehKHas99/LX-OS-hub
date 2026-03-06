#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LX-OS Hub — GitHub Repository Setup Script
# Run this once after cloning to initialize git and push to your GitHub org.
#
# Usage:
#   chmod +x scripts/setup_github.sh
#   GITHUB_ORG=your-org ./scripts/setup_github.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ORG="${GITHUB_ORG:-YOUR_ORG}"
REPO="lxos-hub"
REMOTE="https://github.com/${ORG}/${REPO}.git"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          LX-OS Hub — GitHub Setup                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Org:  ${ORG}"
echo "  Repo: ${REPO}"
echo "  URL:  ${REMOTE}"
echo ""

# 1. Init git if not already
if [ ! -d ".git" ]; then
  echo "→ Initialising git..."
  git init -b main
else
  echo "→ Git already initialised"
fi

# 2. Stage everything (respects .gitignore)
echo "→ Staging all files..."
git add -A

# 3. Initial commit
if git diff --cached --quiet; then
  echo "→ Nothing new to commit"
else
  echo "→ Creating initial commit..."
  git commit -m "feat: initial LX-OS Hub production codebase

- FastAPI backend with 70+ endpoints, auth, RBAC
- Next.js 14 frontend (Studio, Lab, Library, Feed, Admin)
- 13 PostgreSQL migrations (Neon-compatible)
- Redis + RQ async worker
- VS Code extension (Prompt Library, Run Panel, DSL lint)
- Vocode voice agent integration
- GitHub Actions: CI, deploy, Neon branch-per-PR
- Docker Compose dev + production configs
- Nginx reverse proxy with security headers + rate limiting"
fi

# 4. Set remote
if git remote get-url origin &>/dev/null; then
  echo "→ Remote 'origin' already set — updating..."
  git remote set-url origin "${REMOTE}"
else
  echo "→ Adding remote origin..."
  git remote add origin "${REMOTE}"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  Next steps:"
echo ""
echo "  1. Create the repo on GitHub (if not done already):"
echo "     https://github.com/new"
echo "     → Name: ${REPO}   Visibility: Private   NO README"
echo ""
echo "  2. Push:"
echo "     git push -u origin main"
echo ""
echo "  3. Add GitHub Secrets (Settings → Secrets → Actions):"
echo "     NEON_PROJECT_ID   → from console.neon.tech"
echo "     NEON_API_KEY      → from Neon Account → API Keys"
echo "     JWT_SECRET        → python3 -c \"import secrets; print(secrets.token_hex(32))\""
echo "     WEBHOOK_SECRET    → python3 -c \"import secrets; print(secrets.token_hex(32))\""
echo "     VPS_HOST          → your server IP (for deploy workflow)"
echo "     VPS_USER          → root or deploy user"
echo "     VPS_SSH_KEY       → contents of ~/.ssh/id_rsa (deploy key)"
echo ""
echo "  4. Enable GitHub Actions:"
echo "     Repo → Actions → Enable workflows"
echo ""
echo "  5. Create Vercel project (frontend):"
echo "     https://vercel.com/new"
echo "     Root directory: services/web"
echo "     Env var: NEXT_PUBLIC_API_BASE=/api (or your API URL)"
echo ""
echo "  6. Install VS Code extension:"
echo "     cd extensions/vscode && npm install && npm run package"
echo "     code --install-extension lxos-hub-0.1.0.vsix"
echo ""
echo "────────────────────────────────────────────────────────────"
