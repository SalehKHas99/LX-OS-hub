import os

# ── Database & Queue ──────────────────────────────────────────
DATABASE_URL       = os.getenv("DATABASE_URL",        "postgresql://postgres:postgres@postgres:5432/lxos")
REDIS_URL          = os.getenv("REDIS_URL",           "redis://redis:6379/0")

# ── Security ──────────────────────────────────────────────────
JWT_SECRET         = os.getenv("JWT_SECRET",          "")
WEBHOOK_SECRET     = os.getenv("WEBHOOK_SECRET",      "")

# ── LLM Providers ────────────────────────────────────────────
OPENAI_API_KEY     = os.getenv("OPENAI_API_KEY",      "")
ANTHROPIC_API_KEY  = os.getenv("ANTHROPIC_API_KEY",   "")

# ── Google OAuth ──────────────────────────────────────────────
GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID",     "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI",  "http://localhost:3000/auth/callback/google")

# ── App URLs (production) ─────────────────────────────────────
FRONTEND_URL       = os.getenv("FRONTEND_URL", "http://localhost:3000")
# Allowed CORS origins — comma-separated list, or * for dev
ALLOWED_ORIGINS_RAW = os.getenv("ALLOWED_ORIGINS", FRONTEND_URL)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in ALLOWED_ORIGINS_RAW.split(",") if o.strip()]

WEBHOOK_INTERNAL_BASE = os.getenv("WEBHOOK_INTERNAL_BASE", "http://api:8000")
DEMO_MODE          = os.getenv("DEMO_MODE", "true").lower() == "true"

# ── Derived helpers ───────────────────────────────────────────
def llm_provider() -> str:
    """Returns the preferred available provider: anthropic > openai > simulated."""
    if ANTHROPIC_API_KEY:
        return "anthropic"
    if OPENAI_API_KEY:
        return "openai"
    return "simulated"

def assert_secrets():
    missing = []
    if not JWT_SECRET:
        missing.append("JWT_SECRET")
    if not WEBHOOK_SECRET:
        missing.append("WEBHOOK_SECRET")
    if missing:
        import warnings
        warnings.warn(
            f"WARNING: Required secrets not set: {', '.join(missing)}. "
            "Set them in .env before production use.",
            stacklevel=2,
        )
