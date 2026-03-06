import hashlib, hmac, io, json, secrets, csv
from typing import Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse

from app.config import (WEBHOOK_INTERNAL_BASE, WEBHOOK_SECRET, GOOGLE_REDIRECT_URI,
                        FRONTEND_URL, ALLOWED_ORIGINS, DEMO_MODE, llm_provider, assert_secrets)
from app.context import get_context_from_request, RequestContext
from app.db import get_conn
from app.dsl import parse, validate, compile_template
from app.suggest import get_suggestions
from app.search import search_prompts
from app.reco import get_recommendations
from app.auth import (
    register_email, login_email, create_session,
    validate_session, revoke_session,
    google_auth_url, google_exchange_code,
    create_reset_token, use_reset_token,
)
from app.schemas import (
    PromptCreate, PromptVersionCreate, RunCreate,
    SuggestRequest, BenchmarkCreate, BenchmarkRunCreate, OptimizeCreate,
    RatingCreate, CommentCreate,
    WebhookCreate, WebhookPatch, MemberInvite, MemberRolePatch, ApiKeyCreate, ApiKeyPatch,
    RegisterRequest, LoginRequest, PostCreate, PostCommentCreate,
)
from app.queue import runs_q, benchmarks_q, outbox_q
from app.seed import seed_demo, demo_bootstrap
from app.theme import (
    get_all_config, get_config_flat, set_config, set_config_bulk,
    list_themes, get_active_theme, create_theme, update_theme,
    delete_theme, set_default_theme, generate_css, save_upload, list_uploads,
    GOOGLE_FONTS,
)
from fastapi import UploadFile, File, Form
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

assert_secrets()

app = FastAPI(title="LX-OS Hub API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,   # We use Bearer tokens, not cookies — credentials=True+wildcard is rejected by browsers
    allow_methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allow_headers=["Authorization","Content-Type","X-Api-Key","X-Requested-With"],
)

# ── Global: PermissionError → 403, not 500 ────────────────────
from fastapi import Request as _Req
from fastapi.responses import JSONResponse as _JSONResp
from app.context import require_role as _require_role, require_scope as _require_scope

@app.exception_handler(PermissionError)
async def permission_error_handler(_req: _Req, exc: PermissionError):
    return _JSONResp(status_code=403, content={"detail": str(exc)})

def require_admin(c):
    """Raise 403 unless caller is admin or owner."""
    _require_role(c, "admin")

# ── Static file serving for uploads ───────────────────────────
_upload_dir = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_upload_dir)), name="uploads")

# ── helpers ───────────────────────────────────────────────────

def ctx(request: Request) -> RequestContext:
    return get_context_from_request(request)

def write_audit(conn, org_id, actor_id, action, resource=None, resource_id=None, payload=None):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO audit_log (org_id, actor_id, action, resource_type, resource_id, payload) "
            "VALUES (%s,%s,%s,%s,%s,%s::jsonb)",
            (org_id, actor_id, action, resource, resource_id, json.dumps(payload) if payload else None)
        )

def row_to_dict(cur, row):
    cols = [d[0] for d in cur.description]
    return {c: (str(v) if hasattr(v, "hex") else (v.isoformat() if hasattr(v, "isoformat") else v))
            for c, v in zip(cols, row)}

def set_tags(conn, prompt_id: str, tags: list[str]):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM prompt_tags WHERE prompt_id=%s", (prompt_id,))
        for tag in tags:
            cur.execute("INSERT INTO prompt_tags (prompt_id, tag) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                        (prompt_id, tag.strip().lower()))

# ── health / auth ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "provider": llm_provider(), "version": "0.2.0"}

@app.get("/auth/me")
def auth_me(request: Request):
    c = ctx(request)
    # Also fetch user profile info
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT email, username, display_name, avatar_url, auth_provider FROM users WHERE id=%s", (c.user_id,))
            row = cur.fetchone()
    user_info = {}
    if row:
        user_info = {"email": row[0], "username": row[1], "display_name": row[2],
                     "avatar_url": row[3], "auth_provider": row[4]}
    return {"org_id": c.org_id, "user_id": c.user_id, "role": c.role,
            "scopes": c.scopes, **user_info}

@app.post("/auth/register", status_code=201)
async def auth_register(request: Request, body: RegisterRequest):
    try:
        user = register_email(body.email, body.password, body.username or "")
        session_token = create_session(user["user_id"],
                                       request.headers.get("user-agent", ""),
                                       request.client.host if request.client else "")
        return {"session_token": session_token, **user}
    except ValueError as e:
        raise HTTPException(400, str(e))

@app.post("/auth/login")
async def auth_login(request: Request, body: LoginRequest):
    session_token = login_email(body.email, body.password)
    if not session_token:
        raise HTTPException(401, "Invalid email or password")
    user = validate_session(session_token)
    return {"session_token": session_token, **(user or {})}

@app.post("/auth/logout")
async def auth_logout(request: Request):
    from app.context import _extract_token
    token = _extract_token(request)
    if token and token.startswith("lxos_sess_"):
        revoke_session(token)
    return {"logged_out": True}

@app.get("/auth/google")
def auth_google_redirect(redirect_uri: str = ""):
    try:
        uri = redirect_uri or GOOGLE_REDIRECT_URI
        url = google_auth_url(uri)
        return {"url": url}
    except ValueError as e:
        raise HTTPException(503, str(e))

@app.get("/auth/callback/google")
async def auth_google_callback(request: Request, code: str = "", error: str = ""):
    if error:
        return RedirectResponse(f"/?auth_error={error}")
    if not code:
        raise HTTPException(400, "Missing code")
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/auth/callback/google"
        result = google_exchange_code(code, redirect_uri)
        # Redirect to frontend with session token
        return RedirectResponse(
            f"{FRONTEND_URL}/?session_token={result['session_token']}"
        )
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/auth/forgot-password")
async def auth_forgot(body: dict):
    email = body.get("email", "")
    if not email:
        raise HTTPException(400, "Email required")
    token = create_reset_token(email)
    # In production: send email with token. Here: return it (demo only)
    return {"message": "If this email exists, a reset link was sent."}

@app.post("/auth/reset-password")
async def auth_reset(body: dict):
    token = body.get("token", "")
    password = body.get("password", "")
    if not token or not password:
        raise HTTPException(400, "token and password required")
    if not use_reset_token(token, password):
        raise HTTPException(400, "Invalid or expired token")
    return {"reset": True}

# ── social feed / posts ───────────────────────────────────────

@app.get("/posts")
def list_posts(request: Request, limit: int = 30, offset: int = 0, prompt_id: str = ""):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            if prompt_id:
                cur.execute("""
                    SELECT po.id, po.body, po.post_type, po.like_count, po.comment_count,
                           po.created_at, u.username, u.display_name, u.avatar_url,
                           p.id, p.title, p.category
                    FROM posts po
                    JOIN users u ON u.id = po.user_id
                    LEFT JOIN prompts p ON p.id = po.prompt_id
                    WHERE po.prompt_id = %s
                    ORDER BY po.created_at DESC LIMIT %s OFFSET %s
                """, (prompt_id, limit, offset))
            else:
                cur.execute("""
                    SELECT po.id, po.body, po.post_type, po.like_count, po.comment_count,
                           po.created_at, u.username, u.display_name, u.avatar_url,
                           p.id, p.title, p.category
                    FROM posts po
                    JOIN users u ON u.id = po.user_id
                    LEFT JOIN prompts p ON p.id = po.prompt_id
                    WHERE po.org_id = %s OR p.visibility = 'public'
                    ORDER BY po.pinned DESC, po.created_at DESC LIMIT %s OFFSET %s
                """, (c.org_id, limit, offset))
            rows = cur.fetchall()
            # Check which posts current user liked
            post_ids = [str(r[0]) for r in rows]
            liked = set()
            if post_ids:
                placeholders = ",".join(["%s"] * len(post_ids))
                cur.execute(
                    f"SELECT post_id FROM post_likes WHERE post_id IN ({placeholders}) AND user_id=%s",
                    post_ids + [c.user_id]
                )
                liked = {str(r[0]) for r in cur.fetchall()}
            return [
                {
                    "id": str(r[0]), "body": r[1], "post_type": r[2],
                    "like_count": r[3], "comment_count": r[4],
                    "created_at": str(r[5]),
                    "author": {"username": r[6], "display_name": r[7], "avatar_url": r[8]},
                    "prompt": {"id": str(r[9]), "title": r[10], "category": r[11]} if r[9] else None,
                    "liked": str(r[0]) in liked,
                }
                for r in rows
            ]

@app.post("/posts", status_code=201)
async def create_post(request: Request, body: PostCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO posts (org_id, user_id, prompt_id, body, post_type) "
                "VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (c.org_id, c.user_id, body.prompt_id or None, body.body, body.post_type)
            )
            post_id = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "post.created", "post", post_id)
        conn.commit()
    return {"id": post_id}

@app.delete("/posts/{post_id}")
def delete_post(post_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM posts WHERE id=%s AND user_id=%s", (post_id, c.user_id))
        conn.commit()
    return {"deleted": True}

@app.post("/posts/{post_id}/like")
def like_post(post_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO post_likes (post_id, user_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",
                (post_id, c.user_id)
            )
        conn.commit()
    return {"liked": True}

@app.delete("/posts/{post_id}/like")
def unlike_post(post_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM post_likes WHERE post_id=%s AND user_id=%s", (post_id, c.user_id))
        conn.commit()
    return {"liked": False}

@app.get("/posts/{post_id}/comments")
def post_comments(post_id: str, request: Request, limit: int = 50):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pc.id, pc.body, pc.like_count, pc.created_at,
                       u.username, u.display_name, u.avatar_url
                FROM post_comments pc
                JOIN users u ON u.id = pc.user_id
                WHERE pc.post_id = %s
                ORDER BY pc.created_at ASC LIMIT %s
            """, (post_id, limit))
            return [
                {"id": str(r[0]), "body": r[1], "like_count": r[2], "created_at": str(r[3]),
                 "author": {"username": r[4], "display_name": r[5], "avatar_url": r[6]}}
                for r in cur.fetchall()
            ]

@app.post("/posts/{post_id}/comments", status_code=201)
async def add_post_comment(post_id: str, request: Request, body: PostCommentCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO post_comments (post_id, user_id, body) VALUES (%s,%s,%s) RETURNING id",
                (post_id, c.user_id, body.body)
            )
            comment_id = str(cur.fetchone()[0])
        conn.commit()
    return {"id": comment_id}

@app.delete("/posts/{post_id}/comments/{comment_id}")
def delete_post_comment(post_id: str, comment_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM post_comments WHERE id=%s AND user_id=%s", (comment_id, c.user_id))
        conn.commit()
    return {"deleted": True}

# ── prompts ───────────────────────────────────────────────────

@app.get("/prompts")
def list_prompts(request: Request, q: str = "", tags: str = "", category: str = "",
                 visibility: str = "", sort: str = "recent", min_score: float = 0.0,
                 limit: int = 40, offset: int = 0):
    c = ctx(request)
    if q or tags or category or sort != "recent" or min_score > 0:
        return search_prompts(c.org_id, q=q, tags=tags, category=category,
                              visibility=visibility, sort=sort, min_score=min_score,
                              limit=limit, offset=offset)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT p.*, ARRAY_AGG(DISTINCT pt.tag) FILTER (WHERE pt.tag IS NOT NULL) AS tags "
                "FROM prompts p LEFT JOIN prompt_tags pt ON pt.prompt_id=p.id "
                "WHERE p.org_id=%s GROUP BY p.id ORDER BY p.created_at DESC LIMIT %s OFFSET %s",
                (c.org_id, limit, offset)
            )
            return [row_to_dict(cur, r) for r in cur.fetchall()]

@app.post("/prompts", status_code=201)
def create_prompt(request: Request, body: PromptCreate):
    c = ctx(request)
    # Parse + validate DSL
    lint_issues = []
    compiled = body.compiled_template
    dsl_json = None
    if body.dsl_yaml:
        try:
            dsl_dict = parse(body.dsl_yaml)
            dsl_json = dsl_dict
            lint_issues = validate(dsl_dict)
            compiled = compile_template(dsl_dict)
        except ValueError:
            pass

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO prompts (org_id, title, description, visibility, license, category, dsl_yaml, compiled_template, created_by) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (c.org_id, body.title, body.description, body.visibility,
                 body.license, body.category, body.dsl_yaml, compiled, c.user_id)
            )
            prompt_id = str(cur.fetchone()[0])
            set_tags(conn, prompt_id, body.tags)
            cur.execute(
                "INSERT INTO prompt_versions (prompt_id, org_id, version_num, commit_message, dsl_yaml, dsl_json, compiled_template, created_by) "
                "VALUES (%s,%s,1,'Initial version',%s,%s::jsonb,%s,%s) RETURNING id",
                (prompt_id, c.org_id, body.dsl_yaml, json.dumps(dsl_json), compiled, c.user_id)
            )
            version_id = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "prompt.created", "prompt", prompt_id, {"title": body.title})
        conn.commit()
    return {"id": prompt_id, "version_id": version_id, "lint": lint_issues}

@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT p.*, ARRAY_AGG(DISTINCT pt.tag) FILTER (WHERE pt.tag IS NOT NULL) AS tags "
                "FROM prompts p LEFT JOIN prompt_tags pt ON pt.prompt_id=p.id "
                "WHERE p.id=%s AND (p.org_id=%s OR p.visibility='public') GROUP BY p.id",
                (prompt_id, c.org_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404)
            prompt = row_to_dict(cur, row)
            cur.execute("SELECT * FROM prompt_versions WHERE prompt_id=%s ORDER BY version_num DESC", (prompt_id,))
            prompt["versions"] = [row_to_dict(cur, r) for r in cur.fetchall()]
            cur.execute("SELECT COUNT(*) FROM forks WHERE original_prompt_id=%s", (prompt_id,))
            prompt["fork_count"] = cur.fetchone()[0]
            cur.execute("SELECT ROUND(AVG(rating),2) FROM ratings WHERE prompt_id=%s", (prompt_id,))
            prompt["avg_rating"] = float(cur.fetchone()[0] or 0)
            return prompt

@app.post("/prompts/{prompt_id}/versions", status_code=201)
def create_version(prompt_id: str, request: Request, body: PromptVersionCreate):
    c = ctx(request)
    compiled = body.compiled_template
    dsl_json = body.dsl_json
    lint_issues = []
    if body.dsl_yaml:
        try:
            dsl_dict = parse(body.dsl_yaml)
            dsl_json = dsl_dict
            lint_issues = validate(dsl_dict)
            compiled = compile_template(dsl_dict)
        except ValueError:
            pass
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM prompts WHERE id=%s AND org_id=%s", (prompt_id, c.org_id))
            if not cur.fetchone():
                raise HTTPException(404)
            cur.execute("SELECT coalesce(max(version_num),0)+1 FROM prompt_versions WHERE prompt_id=%s", (prompt_id,))
            next_v = cur.fetchone()[0]
            cur.execute(
                "INSERT INTO prompt_versions (prompt_id, org_id, version_num, commit_message, dsl_yaml, dsl_json, compiled_template, created_by) "
                "VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s) RETURNING id",
                (prompt_id, c.org_id, next_v, body.message, body.dsl_yaml,
                 json.dumps(dsl_json), compiled, c.user_id)
            )
            version_id = str(cur.fetchone()[0])
            cur.execute("UPDATE prompts SET updated_at=now() WHERE id=%s", (prompt_id,))
            write_audit(conn, c.org_id, c.user_id, "prompt.version_created", "prompt_version", version_id)
        conn.commit()
    return {"id": version_id, "version_num": next_v, "lint": lint_issues}

@app.get("/prompts/{prompt_id}/versions")
def list_versions(prompt_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM prompt_versions WHERE prompt_id=%s ORDER BY version_num DESC", (prompt_id,))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

@app.post("/prompts/{prompt_id}/fork", status_code=201)
def fork_prompt(prompt_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM prompts WHERE id=%s AND (org_id=%s OR visibility='public')", (prompt_id, c.org_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404)
            src = row_to_dict(cur, row)
            cur.execute(
                "INSERT INTO prompts (org_id, title, description, visibility, license, category, dsl_yaml, compiled_template, created_by) "
                "VALUES (%s,%s,%s,'private',%s,%s,%s,%s,%s) RETURNING id",
                (c.org_id, f"Fork of {src['title']}", src['description'],
                 src['license'], src['category'], src['dsl_yaml'], src['compiled_template'], c.user_id)
            )
            fork_id = str(cur.fetchone()[0])
            # Copy tags
            cur.execute("SELECT tag FROM prompt_tags WHERE prompt_id=%s", (prompt_id,))
            for (tag,) in cur.fetchall():
                cur.execute("INSERT INTO prompt_tags (prompt_id, tag) VALUES (%s,%s) ON CONFLICT DO NOTHING", (fork_id, tag))
            # Copy latest version
            cur.execute("SELECT * FROM prompt_versions WHERE prompt_id=%s ORDER BY version_num DESC LIMIT 1", (prompt_id,))
            pv = row_to_dict(cur, cur.fetchone())
            cur.execute(
                "INSERT INTO prompt_versions (prompt_id, org_id, version_num, commit_message, dsl_yaml, dsl_json, compiled_template, created_by) "
                "VALUES (%s,%s,1,'Forked',%s,%s::jsonb,%s,%s) RETURNING id",
                (fork_id, c.org_id, pv['dsl_yaml'], json.dumps(pv.get('dsl_json')), pv['compiled_template'], c.user_id)
            )
            version_id = str(cur.fetchone()[0])
            # Record fork
            cur.execute(
                "INSERT INTO forks (original_prompt_id, fork_prompt_id, user_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                (prompt_id, fork_id, c.user_id)
            )
            cur.execute("UPDATE prompts SET fork_count=fork_count+1 WHERE id=%s", (prompt_id,))
            write_audit(conn, c.org_id, c.user_id, "prompt.forked", "prompt", fork_id, {"source": prompt_id})
        conn.commit()
    return {"id": fork_id, "version_id": version_id, "forked_from": prompt_id}

@app.delete("/prompts/{prompt_id}")
def delete_prompt(prompt_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM prompts WHERE id=%s AND org_id=%s", (prompt_id, c.org_id))
            write_audit(conn, c.org_id, c.user_id, "prompt.deleted", "prompt", prompt_id)
        conn.commit()
    return {"deleted": True}

# ── ratings + comments ────────────────────────────────────────

@app.post("/prompts/{prompt_id}/rate")
def rate_prompt(prompt_id: str, request: Request, body: RatingCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO ratings (prompt_id, user_id, rating) VALUES (%s,%s,%s) "
                "ON CONFLICT (prompt_id, user_id) DO UPDATE SET rating=excluded.rating",
                (prompt_id, c.user_id, body.rating)
            )
            cur.execute("UPDATE prompts SET avg_rating=(SELECT ROUND(AVG(rating),2) FROM ratings WHERE prompt_id=%s) WHERE id=%s",
                        (prompt_id, prompt_id))
        conn.commit()
    return {"rated": True}

@app.get("/prompts/{prompt_id}/comments")
def get_comments(prompt_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT c.*, u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.prompt_id=%s ORDER BY c.created_at", (prompt_id,))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

@app.post("/prompts/{prompt_id}/comments")
def add_comment(prompt_id: str, request: Request, body: CommentCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO comments (prompt_id, user_id, body) VALUES (%s,%s,%s) RETURNING id",
                        (prompt_id, c.user_id, body.body))
            comment_id = str(cur.fetchone()[0])
        conn.commit()
    return {"id": comment_id}

# ── search ────────────────────────────────────────────────────

@app.get("/search")
def search(request: Request, q: str = "", mode: str = "keyword",
           tags: str = "", category: str = "", min_score: float = 0.0,
           sort: str = "recent", limit: int = 40):
    c = ctx(request)
    # mode: keyword | semantic | hybrid — semantic/hybrid fall back to keyword (no pgvector yet)
    results = search_prompts(c.org_id, q=q, tags=tags, category=category,
                             sort=sort, min_score=min_score, limit=limit)
    return {"results": results, "mode": mode, "total": len(results)}

# ── suggest ───────────────────────────────────────────────────

@app.post("/suggest")
def suggest(request: Request, body: SuggestRequest):
    c = ctx(request)
    suggestions = get_suggestions(body.dsl_yaml, mode=body.mode, goal=body.goal or "")
    # Persist to suggestions table
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO suggestions (user_id, prompt_id, prompt_version_id, mode, goal, input_dsl_yaml, suggestions_json) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb) RETURNING id",
                (c.user_id, body.prompt_id, body.prompt_version_id, body.mode,
                 body.goal, body.dsl_yaml, json.dumps(suggestions))
            )
            suggestion_id = str(cur.fetchone()[0])
        conn.commit()
    return {"id": suggestion_id, "suggestions": suggestions, "count": len(suggestions)}

# ── runs ──────────────────────────────────────────────────────

@app.post("/runs", status_code=202)
def create_run(request: Request, body: RunCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM prompt_versions WHERE id=%s AND org_id=%s", (body.prompt_version_id, c.org_id))
            if not cur.fetchone():
                raise HTTPException(404, "Prompt version not found")
            cur.execute(
                "INSERT INTO runs (org_id, prompt_version_id, model, model_config, inputs, request_id, created_by) "
                "VALUES (%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s) RETURNING id",
                (c.org_id, body.prompt_version_id, body.model,
                 json.dumps(body.model_config), json.dumps(body.inputs), body.request_id, c.user_id)
            )
            run_id = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "run.created", "run", run_id)
        conn.commit()
    from app.jobs import run_execution_job
    runs_q.enqueue(run_execution_job, run_id)
    return {"id": run_id, "run_id": run_id, "status": "queued"}

@app.get("/runs")
def list_runs(request: Request, limit: int = 50, offset: int = 0, status: str = ""):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            if status:
                cur.execute("SELECT * FROM runs WHERE org_id=%s AND status=%s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                            (c.org_id, status, limit, offset))
            else:
                cur.execute("SELECT * FROM runs WHERE org_id=%s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                            (c.org_id, limit, offset))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

@app.get("/runs/{run_id}")
def get_run(run_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM runs WHERE id=%s AND org_id=%s", (run_id, c.org_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404)
            run = row_to_dict(cur, row)
            cur.execute("SELECT * FROM run_events WHERE run_id=%s ORDER BY created_at", (run_id,))
            run["events"] = [row_to_dict(cur, r) for r in cur.fetchall()]
            return run

@app.post("/runs/{run_id}/replay", status_code=202)
def replay_run(run_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT prompt_version_id, model, model_config, inputs FROM runs WHERE id=%s AND org_id=%s", (run_id, c.org_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404)
            pv_id, model, mc, inputs = row
            cur.execute(
                "INSERT INTO runs (org_id, prompt_version_id, model, model_config, inputs, created_by) "
                "VALUES (%s,%s,%s,%s::jsonb,%s::jsonb,%s) RETURNING id",
                (c.org_id, pv_id, model, json.dumps(mc), json.dumps(inputs), c.user_id)
            )
            new_id = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "run.replayed", "run", new_id, {"source": run_id})
        conn.commit()
    from app.jobs import run_execution_job
    runs_q.enqueue(run_execution_job, new_id)
    return {"id": new_id, "status": "queued"}

# ── benchmarks ────────────────────────────────────────────────

@app.get("/benchmarks")
def list_benchmarks(request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM benchmarks WHERE org_id=%s ORDER BY created_at DESC", (c.org_id,))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

@app.post("/benchmarks", status_code=201)
def create_benchmark(request: Request, body: BenchmarkCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO benchmarks (owner_user_id, org_id, title, description, cases) "
                "VALUES (%s,%s,%s,%s,%s::jsonb) RETURNING id",
                (c.user_id, c.org_id, body.title, body.description, json.dumps(body.cases))
            )
            bench_id = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "benchmark.created", "benchmark", bench_id)
        conn.commit()
    return {"id": bench_id}

@app.get("/benchmarks/{benchmark_id}")
def get_benchmark(benchmark_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM benchmarks WHERE id=%s AND org_id=%s", (benchmark_id, c.org_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404)
            bench = row_to_dict(cur, row)
            cur.execute("SELECT * FROM benchmark_runs WHERE benchmark_id=%s ORDER BY created_at DESC LIMIT 20", (benchmark_id,))
            bench["runs"] = [row_to_dict(cur, r) for r in cur.fetchall()]
            return bench

@app.post("/benchmarks/{benchmark_id}/run", status_code=202)
def run_benchmark(benchmark_id: str, request: Request, body: BenchmarkRunCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM benchmarks WHERE id=%s AND org_id=%s", (benchmark_id, c.org_id))
            if not cur.fetchone():
                raise HTTPException(404)
            cur.execute("SELECT id FROM prompt_versions WHERE id=%s AND org_id=%s", (body.prompt_version_id, c.org_id))
            if not cur.fetchone():
                raise HTTPException(404, "Prompt version not found")
            cur.execute(
                "INSERT INTO benchmark_runs (benchmark_id, prompt_version_id) VALUES (%s,%s) RETURNING id",
                (benchmark_id, body.prompt_version_id)
            )
            br_id = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "benchmark.run_started", "benchmark_run", br_id)
        conn.commit()
    from app.jobs import benchmark_run_job
    benchmarks_q.enqueue(benchmark_run_job, br_id)
    return {"id": br_id, "status": "queued"}

@app.get("/benchmarks/{benchmark_id}/runs/{run_id}")
def get_benchmark_run(benchmark_id: str, run_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT br.* FROM benchmark_runs br JOIN benchmarks b ON b.id=br.benchmark_id "
                "WHERE br.id=%s AND b.org_id=%s", (run_id, c.org_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404)
            return row_to_dict(cur, row)

# ── optimize ──────────────────────────────────────────────────

@app.post("/optimize", status_code=202)
def optimize(request: Request, body: OptimizeCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM prompt_versions WHERE id=%s AND org_id=%s", (body.prompt_version_id, c.org_id))
            if not cur.fetchone():
                raise HTTPException(404, "Prompt version not found")
            cur.execute("SELECT id FROM benchmarks WHERE id=%s AND org_id=%s", (body.benchmark_id, c.org_id))
            if not cur.fetchone():
                raise HTTPException(404, "Benchmark not found")
            budget = body.budget or {"max_variants": 6, "max_total_runs": 60}
            cur.execute(
                "INSERT INTO optimization_jobs (user_id, org_id, baseline_prompt_version_id, benchmark_id, objective, budget) "
                "VALUES (%s,%s,%s,%s,%s,%s::jsonb) RETURNING id",
                (c.user_id, c.org_id, body.prompt_version_id, body.benchmark_id, body.objective, json.dumps(budget))
            )
            job_id = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "optimize.started", "optimization_job", job_id)
        conn.commit()
    from app.jobs import optimization_job
    benchmarks_q.enqueue(optimization_job, job_id)
    return {"id": job_id, "status": "queued"}

@app.get("/optimize/{job_id}")
def get_optimization(job_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM optimization_jobs WHERE id=%s AND org_id=%s", (job_id, c.org_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404)
            job = row_to_dict(cur, row)
            cur.execute("SELECT * FROM optimization_variants WHERE optimization_job_id=%s ORDER BY aggregate_score DESC NULLS LAST", (job_id,))
            job["variants"] = [row_to_dict(cur, r) for r in cur.fetchall()]
            return job

# ── recommendations + search ──────────────────────────────────

@app.get("/recommendations")
def recommendations(request: Request, limit: int = 20, ref_prompt_id: str = ""):
    c = ctx(request)
    items = get_recommendations(c.org_id, limit=limit, ref_prompt_id=ref_prompt_id or None)
    return {"items": items}

# ── audit ─────────────────────────────────────────────────────

@app.get("/audit")
def get_audit(request: Request, limit: int = 50, offset: int = 0):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM audit_log WHERE org_id=%s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                        (c.org_id, limit, offset))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

# ── outbox ────────────────────────────────────────────────────

@app.get("/outbox/stats")
def outbox_stats(request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT status, count(*) FROM event_outbox WHERE org_id=%s GROUP BY status", (c.org_id,))
            return {r[0]: r[1] for r in cur.fetchall()}

@app.post("/outbox/dispatch")
def dispatch_outbox(request: Request):
    from app.jobs import dispatch_outbox_job
    outbox_q.enqueue(dispatch_outbox_job)
    return {"queued": True}

@app.get("/outbox")
def list_outbox(request: Request, limit: int = 50):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM event_outbox WHERE org_id=%s ORDER BY created_at DESC LIMIT %s", (c.org_id, limit))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

# ── analytics ─────────────────────────────────────────────────

@app.get("/analytics/runs")
def analytics_runs(request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT date_trunc('day', created_at) AS day, count(*) AS total, "
                "sum(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) AS succeeded, "
                "sum(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, "
                "avg(latency_ms) AS avg_latency_ms, sum(cost_usd) AS total_cost_usd "
                "FROM runs WHERE org_id=%s GROUP BY 1 ORDER BY 1 DESC LIMIT 30", (c.org_id,)
            )
            return [{"day": str(r[0]), "total": r[1], "succeeded": r[2], "failed": r[3],
                     "avg_latency_ms": float(r[4] or 0), "total_cost_usd": float(r[5] or 0)}
                    for r in cur.fetchall()]

@app.get("/analytics/runs/export")
def export_runs(request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, status, model, provider, latency_ms, tokens_in, tokens_out, cost_usd, created_at, finished_at "
                "FROM runs WHERE org_id=%s ORDER BY created_at DESC LIMIT 10000", (c.org_id,)
            )
            rows = cur.fetchall()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id","status","model","provider","latency_ms","tokens_in","tokens_out","cost_usd","created_at","finished_at"])
    for r in rows:
        w.writerow(r)
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=runs.csv"})

# ── webhooks / integrations ───────────────────────────────────

@app.get("/webhooks")
def list_webhooks(request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM webhooks WHERE org_id=%s ORDER BY created_at DESC", (c.org_id,))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

@app.post("/webhooks")
def create_webhook(request: Request, body: WebhookCreate):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO webhooks (org_id, url, events) VALUES (%s,%s,%s) RETURNING id, secret",
                        (c.org_id, body.url, body.events))
            row = cur.fetchone()
            write_audit(conn, c.org_id, c.user_id, "webhook.created", "webhook", str(row[0]))
        conn.commit()
    return {"id": str(row[0]), "secret": row[1]}

@app.patch("/webhooks/{webhook_id}")
def patch_webhook(webhook_id: str, request: Request, body: WebhookPatch):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            if body.enabled is not None:
                cur.execute("UPDATE webhooks SET enabled=%s WHERE id=%s AND org_id=%s", (body.enabled, webhook_id, c.org_id))
            if body.events is not None:
                cur.execute("UPDATE webhooks SET events=%s WHERE id=%s AND org_id=%s", (body.events, webhook_id, c.org_id))
        conn.commit()
    return {"updated": True}

@app.delete("/webhooks/{webhook_id}")
def delete_webhook(webhook_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM webhooks WHERE id=%s AND org_id=%s", (webhook_id, c.org_id))
        conn.commit()
    return {"deleted": True}

@app.get("/webhooks/{webhook_id}/deliveries")
def webhook_deliveries(webhook_id: str, request: Request, limit: int = 50):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT wd.* FROM webhook_deliveries wd JOIN webhooks w ON w.id=wd.webhook_id "
                "WHERE wd.webhook_id=%s AND w.org_id=%s ORDER BY wd.created_at DESC LIMIT %s",
                (webhook_id, c.org_id, limit)
            )
            return [row_to_dict(cur, r) for r in cur.fetchall()]

# ── simulator ─────────────────────────────────────────────────

@app.post("/sim/receiver/{receiver_id}")
async def sim_receive(receiver_id: str, request: Request):
    body_bytes = await request.body()
    try:
        body_json = json.loads(body_bytes)
    except Exception:
        body_json = {"raw": body_bytes.decode()}
    headers_dict = dict(request.headers)
    event_type = headers_dict.get("x-lxos-event", "unknown")
    sig = headers_dict.get("x-lxos-signature", "")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT org_id FROM simulator_receivers WHERE id=%s", (receiver_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404)
            org_id = row[0]
            cur.execute("SELECT secret FROM webhooks WHERE org_id=%s AND url LIKE %s LIMIT 1", (org_id, f"%{receiver_id}%"))
            secret_row = cur.fetchone()
            sig_valid = False
            for key in filter(None, [secret_row[0] if secret_row else None, WEBHOOK_SECRET]):
                expected = hmac.new(key.encode(), body_bytes, hashlib.sha256).hexdigest()
                if hmac.compare_digest(sig, expected):
                    sig_valid = True
                    break
            cur.execute(
                "INSERT INTO simulator_inbox (org_id, receiver_id, event_type, headers, body, sig_valid) "
                "VALUES (%s,%s,%s,%s::jsonb,%s::jsonb,%s)",
                (org_id, receiver_id, event_type, json.dumps(headers_dict), json.dumps(body_json), sig_valid)
            )
        conn.commit()
    return {"received": True, "sig_valid": sig_valid}

@app.get("/sim/inbox")
def sim_inbox(request: Request, limit: int = 50):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM simulator_inbox WHERE org_id=%s ORDER BY received_at DESC LIMIT %s", (c.org_id, limit))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

@app.get("/sim/receivers")
def list_receivers(request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM simulator_receivers WHERE org_id=%s ORDER BY created_at DESC", (c.org_id,))
            return [row_to_dict(cur, r) for r in cur.fetchall()]

@app.post("/sim/receivers")
async def create_receiver(request: Request):
    c = ctx(request)
    try:
        body = await request.json()
        name = body.get("name", "Receiver")
    except Exception:
        name = "Receiver"
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO simulator_receivers (org_id, name) VALUES (%s,%s) RETURNING id", (c.org_id, name))
            receiver_id = str(cur.fetchone()[0])
        conn.commit()
    return {"id": receiver_id}

# ── members ───────────────────────────────────────────────────

@app.get("/members")
def list_members(request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT m.id, u.email, u.username, m.role, m.created_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=%s ORDER BY m.created_at", (c.org_id,))
            return [{"id": str(r[0]), "email": r[1], "username": r[2], "role": r[3], "created_at": str(r[4])} for r in cur.fetchall()]

@app.post("/members")
def invite_member(request: Request, body: MemberInvite):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email=%s", (body.email,))
            row = cur.fetchone()
            if row:
                user_id = row[0]
            else:
                cur.execute("INSERT INTO users (email, username) VALUES (%s,%s) RETURNING id",
                            (body.email, body.username or body.email.split("@")[0]))
                user_id = cur.fetchone()[0]
            cur.execute("INSERT INTO memberships (org_id, user_id, role) VALUES (%s,%s,%s) ON CONFLICT (org_id, user_id) DO UPDATE SET role=excluded.role RETURNING id",
                        (c.org_id, user_id, body.role))
            mid = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "member.invited", "membership", mid, {"email": body.email})
        conn.commit()
    return {"id": mid}

@app.patch("/members/{membership_id}")
def update_member(membership_id: str, request: Request, body: MemberRolePatch):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE memberships SET role=%s WHERE id=%s AND org_id=%s", (body.role, membership_id, c.org_id))
        conn.commit()
    return {"updated": True}

@app.delete("/members/{membership_id}")
def remove_member(membership_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM memberships WHERE id=%s AND org_id=%s", (membership_id, c.org_id))
        conn.commit()
    return {"deleted": True}

# ── API keys ──────────────────────────────────────────────────

@app.get("/api-keys")
def list_api_keys(request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, subject_type, subject_id, scopes, created_at, revoked_at FROM api_keys WHERE org_id=%s ORDER BY created_at DESC", (c.org_id,))
            return [{"id": str(r[0]), "name": r[1], "subject_type": r[2], "subject_id": str(r[3]) if r[3] else None,
                     "scopes": r[4], "created_at": str(r[5]), "revoked_at": str(r[6]) if r[6] else None}
                    for r in cur.fetchall()]

@app.post("/api-keys")
def create_api_key(request: Request, body: ApiKeyCreate):
    c = ctx(request)
    raw_key = f"lxos_{secrets.token_hex(24)}"
    hashed = hashlib.sha256(raw_key.encode()).hexdigest()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO api_keys (org_id, name, hashed_key, subject_type, subject_id, scopes, created_by) VALUES (%s,%s,%s,'user',%s,%s,%s) RETURNING id",
                        (c.org_id, body.name, hashed, c.user_id, body.scopes, c.user_id))
            key_id = str(cur.fetchone()[0])
            write_audit(conn, c.org_id, c.user_id, "api_key.created", "api_key", key_id)
        conn.commit()
    return {"id": key_id, "key": raw_key}

@app.patch("/api-keys/{key_id}")
def update_api_key(key_id: str, request: Request, body: ApiKeyPatch):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE api_keys SET scopes=%s WHERE id=%s AND org_id=%s", (body.scopes, key_id, c.org_id))
        conn.commit()
    return {"updated": True}

@app.delete("/api-keys/{key_id}")
def revoke_api_key(key_id: str, request: Request):
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE api_keys SET revoked_at=now() WHERE id=%s AND org_id=%s", (key_id, c.org_id))
        conn.commit()
    return {"revoked": True}

# ── demo bootstrap ────────────────────────────────────────────

@app.post("/demo/seed")
def demo_seed(request: Request):
    if not DEMO_MODE:
        raise HTTPException(404, "Not found")
    c = ctx(request)
    with get_conn() as conn:
        seed_demo(conn, c.org_id, c.user_id)
        raw_key = demo_bootstrap(conn, c.org_id, c.user_id, WEBHOOK_INTERNAL_BASE)
        conn.commit()
    return {"seeded": True, "key": raw_key}

@app.get("/demo/status")
def demo_status(request: Request):
    if not DEMO_MODE:
        raise HTTPException(404, "Not found")
    c = ctx(request)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM prompts WHERE org_id=%s", (c.org_id,))
            p = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM runs WHERE org_id=%s", (c.org_id,))
            r = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM api_keys WHERE org_id=%s AND revoked_at IS NULL", (c.org_id,))
            k = cur.fetchone()[0]
    return {"prompts": p, "runs": r, "active_keys": k}

# ══════════════════════════════════════════════════════════════
# THEME / SITE-CONFIG / UPLOAD ROUTES
# ══════════════════════════════════════════════════════════════

# ── Public: active theme as CSS ───────────────────────────────

@app.get("/theme/css")
def theme_css():
    """Returns a CSS :root block with all active design tokens. Frontend injects this."""
    tokens = get_active_theme()
    css = generate_css(tokens)
    return Response(content=css, media_type="text/css",
                    headers={"Cache-Control": "no-cache"})

@app.get("/theme/tokens")
def theme_tokens():
    """Returns active theme tokens as JSON for live preview."""
    return get_active_theme()

@app.get("/theme/fonts")
def theme_fonts():
    return {"fonts": GOOGLE_FONTS}

@app.get("/theme/site-config")
def theme_site_config():
    """
    Public endpoint — returns safe branding and nav config for the frontend shell.
    Does NOT require authentication. Never exposes colour tokens or sensitive admin keys.
    """
    cfg = get_config_flat()
    safe_keys = {
        "site_name", "site_tagline", "site_logo_url",
        "nav_show_feed", "nav_show_library", "nav_show_lab",
        "nav_show_bench", "nav_show_optimize",
    }
    return {k: v for k, v in cfg.items() if k in safe_keys}

# ── Themes CRUD ───────────────────────────────────────────────

@app.get("/admin/themes")
def admin_list_themes(request: Request):
    c = ctx(request)
    require_admin(c)
    return list_themes()

@app.post("/admin/themes", status_code=201)
async def admin_create_theme(request: Request):
    c = ctx(request)
    require_admin(c)
    body = await request.json()
    name = body.get("name", "").strip()
    slug = body.get("slug", name.lower().replace(" ", "-")).strip()
    tokens = body.get("tokens", {})
    if not name:
        raise HTTPException(400, "name required")
    theme_id = create_theme(name, slug, tokens, c.user_id)
    with get_conn() as conn:
        write_audit(conn, c.org_id, c.user_id, "theme.created", "theme", theme_id)
    return {"id": theme_id}

@app.patch("/admin/themes/{theme_id}")
async def admin_update_theme(theme_id: str, request: Request):
    c = ctx(request)
    require_admin(c)
    body = await request.json()
    ok = update_theme(theme_id, body)
    if not ok:
        raise HTTPException(404, "Theme not found or is built-in")
    with get_conn() as conn:
        write_audit(conn, c.org_id, c.user_id, "theme.updated", "theme", theme_id)
    return {"updated": True}

@app.delete("/admin/themes/{theme_id}")
def admin_delete_theme(theme_id: str, request: Request):
    c = ctx(request)
    require_admin(c)
    ok = delete_theme(theme_id)
    if not ok:
        raise HTTPException(400, "Cannot delete built-in or default theme")
    with get_conn() as conn:
        write_audit(conn, c.org_id, c.user_id, "theme.deleted", "theme", theme_id)
    return {"deleted": True}

@app.post("/admin/themes/{theme_id}/activate")
def admin_activate_theme(theme_id: str, request: Request):
    c = ctx(request)
    require_admin(c)
    set_default_theme(theme_id)
    with get_conn() as conn:
        write_audit(conn, c.org_id, c.user_id, "theme.activated", "theme", theme_id)
    return {"activated": True}

# ── Site config CRUD ──────────────────────────────────────────

@app.get("/admin/config")
def admin_get_config(request: Request):
    c = ctx(request)
    require_admin(c)
    return get_all_config()

@app.patch("/admin/config")
async def admin_patch_config(request: Request):
    c = ctx(request)
    require_admin(c)
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "Expected JSON object")
    set_config_bulk(body, c.user_id)
    with get_conn() as conn:
        write_audit(conn, c.org_id, c.user_id, "config.updated", payload=body)
    return {"updated": list(body.keys())}

@app.patch("/admin/config/{key}")
async def admin_patch_config_key(key: str, request: Request):
    c = ctx(request)
    require_admin(c)
    body = await request.json()
    value = body.get("value", "")
    ok = set_config(key, str(value), c.user_id)
    if not ok:
        raise HTTPException(404, f"Config key '{key}' not found")
    with get_conn() as conn:
        write_audit(conn, c.org_id, c.user_id, "config.updated", "site_config", key, {"value": value})
    return {"key": key, "value": value}

# ── Image upload ──────────────────────────────────────────────

# Purposes that require admin — site-wide assets
_ADMIN_PURPOSES = {"logo", "banner"}

@app.post("/upload", status_code=201)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    purpose: str = Form(default="avatar"),
):
    c = ctx(request)
    if purpose in _ADMIN_PURPOSES:
        require_admin(c)   # logo / banner = admin only
    file_bytes = await file.read()
    mime = file.content_type or "application/octet-stream"
    try:
        result = save_upload(file_bytes, file.filename or "upload", mime,
                             c.user_id, c.org_id, purpose)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with get_conn() as conn:
        write_audit(conn, c.org_id, c.user_id, "upload.created",
                    "upload", result["id"], {"purpose": purpose, "sha256": result["sha256"]})
    return result

@app.get("/upload/me")
def my_uploads(request: Request):
    c = ctx(request)
    return list_uploads(c.user_id)

@app.get("/admin/uploads")
def admin_all_uploads(request: Request, limit: int = 100):
    """Admin view — all uploads across all users."""
    c = ctx(request)
    require_admin(c)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.filename_original, u.mime_type, u.size_bytes,
                       u.purpose, u.url_path, u.sha256_hash, u.created_at,
                       usr.username, usr.email
                FROM uploads u
                JOIN users usr ON usr.id = u.user_id
                ORDER BY u.created_at DESC LIMIT %s
            """, (limit,))
            return [
                {"id": str(r[0]), "filename": r[1], "mime": r[2], "size": r[3],
                 "purpose": r[4], "url": r[5], "sha256": r[6], "created_at": str(r[7]),
                 "uploader": {"username": r[8], "email": r[9]}}
                for r in cur.fetchall()
            ]
