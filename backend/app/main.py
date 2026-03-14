from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.database.session import check_db_connectivity
from app.logging_config import configure_logging, get_logger
from app.routers import auth

configure_logging()
logger = get_logger(__name__)
from app.routers import prompts, search, communities, collections, profiles, reports
from app.routers import lab
from app.routers import uploads
from app.routers import community_posts
from app.routers import notifications
from app.routers import moderator_invites
from app.routers import messages, friends, blocks

_IS_PROD = (settings.ENVIRONMENT or "").strip().lower() in ("production", "prod")

app = FastAPI(
    title="LX-OS API",
    version="0.4.0",
    docs_url=None if _IS_PROD else "/docs",
    redoc_url=None if _IS_PROD else "/redoc",
)

# Security headers (no sensitive cookies; same site handled by frontend)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Liveness: app is up. No DB check."""
    return {"status": "ok", "version": "0.4.0"}


@app.get("/health/ready")
async def health_ready():
    """Readiness: app + DB. Returns 503 if DB unreachable (e.g. for k8s readiness probe)."""
    if await check_db_connectivity():
        return {"status": "ok", "version": "0.4.0", "db": "connected"}
    logger.warning("health_ready: DB unreachable")
    return JSONResponse(
        status_code=503,
        content={"status": "degraded", "db": "unreachable"},
    )


# Auth
app.include_router(auth.router, prefix="/api/v1")

# Phase 4 routers
app.include_router(prompts.router,     prefix="/api/v1")
app.include_router(search.router,      prefix="/api/v1")
app.include_router(communities.router, prefix="/api/v1")
app.include_router(community_posts.router, prefix="/api/v1")
app.include_router(collections.router, prefix="/api/v1")
app.include_router(profiles.router,    prefix="/api/v1")
app.include_router(reports.router,     prefix="/api/v1")
app.include_router(lab.router,        prefix="/api/v1")
app.include_router(uploads.router,    prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(moderator_invites.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(friends.router, prefix="/api/v1")
app.include_router(blocks.router, prefix="/api/v1")
