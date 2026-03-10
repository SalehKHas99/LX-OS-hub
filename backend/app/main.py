from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth
from app.routers import prompts, search, communities, collections, profiles, reports
from app.routers import lab
from app.routers import uploads

app = FastAPI(
    title="LX-OS API",
    version="0.4.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.4.0"}


# Auth
app.include_router(auth.router, prefix="/api/v1")

# Phase 4 routers
app.include_router(prompts.router,     prefix="/api/v1")
app.include_router(search.router,      prefix="/api/v1")
app.include_router(communities.router, prefix="/api/v1")
app.include_router(collections.router, prefix="/api/v1")
app.include_router(profiles.router,    prefix="/api/v1")
app.include_router(reports.router,     prefix="/api/v1")
app.include_router(lab.router,        prefix="/api/v1")
app.include_router(uploads.router,    prefix="/api/v1")
