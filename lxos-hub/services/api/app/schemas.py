from pydantic import BaseModel, field_validator, EmailStr
from typing import Any

# ── Auth ──────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    username: str | None = None

    @field_validator("password")
    @classmethod
    def password_min(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

class LoginRequest(BaseModel):
    email: str
    password: str

# ── Social feed ───────────────────────────────────────────────
class PostCreate(BaseModel):
    body: str
    post_type: str = "share"
    prompt_id: str | None = None

    @field_validator("post_type")
    @classmethod
    def valid_type(cls, v):
        if v not in ("share", "review", "question", "showcase"):
            raise ValueError("Invalid post_type")
        return v

    @field_validator("body")
    @classmethod
    def body_length(cls, v):
        if not v.strip():
            raise ValueError("Body cannot be empty")
        if len(v) > 2000:
            raise ValueError("Body max 2000 characters")
        return v

class PostCommentCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def body_length(cls, v):
        if not v.strip():
            raise ValueError("Comment cannot be empty")
        if len(v) > 1000:
            raise ValueError("Comment max 1000 characters")
        return v

# ── Prompts ───────────────────────────────────────────────────
class PromptCreate(BaseModel):
    title: str
    description: str | None = None
    visibility: str = "private"
    license: str | None = "CC-BY-4.0"
    category: str | None = None
    tags: list[str] = []
    dsl_yaml: str | None = None
    compiled_template: str | None = None

class PromptVersionCreate(BaseModel):
    dsl_yaml: str
    message: str = "Update"
    dsl_json: dict[str, Any] | None = None
    compiled_template: str | None = None

# ── Runs ──────────────────────────────────────────────────────
class RunCreate(BaseModel):
    prompt_version_id: str
    model: str = "gpt-4o-mini"
    model_config: dict[str, Any] | None = None
    inputs: dict[str, Any] | None = None
    request_id: str | None = None

# ── Suggest ───────────────────────────────────────────────────
class SuggestRequest(BaseModel):
    dsl_yaml: str
    mode: str = "lint_only"
    goal: str | None = None
    prompt_id: str | None = None
    prompt_version_id: str | None = None

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, v):
        if v not in ("lint_only", "lint_plus_llm"):
            raise ValueError("mode must be lint_only or lint_plus_llm")
        return v

# ── Benchmarks ────────────────────────────────────────────────
class BenchmarkCreate(BaseModel):
    title: str
    description: str | None = None
    cases: list[dict[str, Any]] = []

class BenchmarkRunCreate(BaseModel):
    prompt_version_id: str
    budget: dict[str, Any] | None = None

# ── Optimize ──────────────────────────────────────────────────
class OptimizeCreate(BaseModel):
    prompt_version_id: str
    benchmark_id: str
    objective: str = "maximize_score_under_budget"
    budget: dict[str, Any] | None = None

# ── Ratings / Comments ────────────────────────────────────────
class RatingCreate(BaseModel):
    rating: int

    @field_validator("rating")
    @classmethod
    def valid_rating(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Rating must be 1–5")
        return v

class CommentCreate(BaseModel):
    body: str

# ── Webhooks / Access ─────────────────────────────────────────
class WebhookCreate(BaseModel):
    url: str
    events: list[str]

class WebhookPatch(BaseModel):
    enabled: bool | None = None
    events: list[str] | None = None

class MemberInvite(BaseModel):
    email: str
    username: str | None = None
    role: str = "viewer"

class MemberRolePatch(BaseModel):
    role: str

class ApiKeyCreate(BaseModel):
    name: str | None = None
    scopes: list[str] = []

class ApiKeyPatch(BaseModel):
    scopes: list[str]
