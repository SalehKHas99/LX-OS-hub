from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config.settings import settings
from app.database.session import engine
from app.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown — dispose connection pool cleanly
    await engine.dispose()


app = FastAPI(
    title="LX-OS API",
    version="0.1.0",
    description="LX-OS Context Engineering Marketplace — backend API",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global error handler ─────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")

# Phase 4+ routers (stubs — uncomment as each phase is built)
# from app.routers import prompts, communities, profiles, collections, search, lab, moderation
# app.include_router(prompts.router, prefix="/api/v1")
# app.include_router(communities.router, prefix="/api/v1")
# app.include_router(profiles.router, prefix="/api/v1")
# app.include_router(collections.router, prefix="/api/v1")
# app.include_router(search.router, prefix="/api/v1")
# app.include_router(lab.router, prefix="/api/v1")
# app.include_router(moderation.router, prefix="/api/v1")
