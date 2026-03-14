from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────
    DATABASE_URL: str
    # Must use asyncpg driver format:
    # postgresql+asyncpg://user:password@host/dbname

    # ── Auth ──────────────────────────────────────────────
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── App ───────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173"
    # Multiple origins: comma-separated
    # e.g. "http://localhost:5173,https://lxos.netlify.app"

    # ── AI ────────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""

    # ── Storage (Supabase) ────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        env = (self.ENVIRONMENT or "").strip().lower()
        if env in ("production", "prod"):
            if len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters in production")
            if not self.CORS_ORIGINS or not self.CORS_ORIGINS.strip():
                raise ValueError("CORS_ORIGINS must be set in production")
        return self

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
