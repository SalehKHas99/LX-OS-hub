from dataclasses import dataclass
import hashlib
from fastapi import Request
from app.db import get_conn
from app.config import DEMO_MODE

ROLE_ORDER = {"viewer": 1, "editor": 2, "admin": 3, "owner": 4}

@dataclass
class RequestContext:
    org_id: str
    user_id: str
    role: str
    scopes: list[str]

ALL_SCOPES = [
    "prompts:read","prompts:write","runs:read","runs:write",
    "integrations:read","integrations:write","access:read","access:write","audit:read"
]

def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    if auth.lower().startswith("apikey "):
        return auth.split(" ", 1)[1].strip()
    return request.headers.get("x-api-key")

def ensure_demo_user(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email=%s", ("demo@lxos.local",))
        row = cur.fetchone()
        if row:
            return row[0]
        cur.execute(
            "INSERT INTO users (email, username, auth_provider, email_verified) VALUES (%s,%s,'demo',TRUE) RETURNING id",
            ("demo@lxos.local", "demo")
        )
        return cur.fetchone()[0]

def ensure_demo_org(conn, user_id):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM organizations WHERE slug=%s", ("demo-org",))
        row = cur.fetchone()
        if row:
            org_id = row[0]
        else:
            cur.execute("INSERT INTO organizations (name, slug) VALUES (%s,%s) RETURNING id", ("Demo Org", "demo-org"))
            org_id = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO memberships (org_id, user_id, role) VALUES (%s,%s,'owner') ON CONFLICT (org_id, user_id) DO NOTHING",
            (org_id, user_id)
        )
        return org_id

def _get_user_org(conn, user_id: str) -> tuple[str, str]:
    """Return (org_id, role) for a user's primary org."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT org_id, role FROM memberships WHERE user_id=%s ORDER BY created_at LIMIT 1",
            (user_id,)
        )
        row = cur.fetchone()
        if row:
            return str(row[0]), row[1]
    # fallback: create org
    org_id = ensure_demo_org(conn, user_id)
    return str(org_id), "owner"

def get_context_from_request(request: Request) -> RequestContext:
    token = _extract_token(request)
    with get_conn() as conn:
        if token:
            # Try session token first (lxos_sess_...)
            if token.startswith("lxos_sess_"):
                from app.auth import validate_session
                user = validate_session(token)
                if user:
                    org_id, role = _get_user_org(conn, user["user_id"])
                    return RequestContext(org_id=org_id, user_id=user["user_id"],
                                         role=role, scopes=ALL_SCOPES)
            # Try API key
            hashed = hashlib.sha256(token.encode()).hexdigest()
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT org_id, subject_type, subject_id, scopes FROM api_keys "
                    "WHERE hashed_key=%s AND revoked_at IS NULL",
                    (hashed,)
                )
                row = cur.fetchone()
                if row:
                    org_id, subject_type, subject_id, scopes = row
                    role = "admin"
                    if subject_type == "user":
                        cur.execute("SELECT role FROM memberships WHERE org_id=%s AND user_id=%s", (org_id, subject_id))
                        role_row = cur.fetchone()
                        if role_row:
                            role = role_row[0]
                    return RequestContext(org_id=str(org_id), user_id=str(subject_id),
                                         role=role, scopes=scopes or [])

        # ── Unauthenticated fallback ──────────────────────────────
        # In DEMO_MODE: use seeded demo user (owner for convenience).
        # In PRODUCTION (DEMO_MODE=false): return a locked-down guest context.
        if DEMO_MODE:
            user_id = ensure_demo_user(conn)
            org_id = ensure_demo_org(conn, user_id)
            conn.commit()
            return RequestContext(org_id=str(org_id), user_id=str(user_id),
                                  role="owner", scopes=ALL_SCOPES)
        else:
            # Production: anonymous guest — read-only viewer with no org
            # Most write endpoints will fail gracefully (FK violations → 400)
            return RequestContext(org_id="", user_id="", role="viewer", scopes=["prompts:read"])

def require_role(ctx: RequestContext, minimum: str):
    if ROLE_ORDER.get(ctx.role, 0) < ROLE_ORDER.get(minimum, 999):
        raise PermissionError(f"Requires role {minimum}")

def require_scope(ctx: RequestContext, scope: str):
    if scope not in ctx.scopes:
        raise PermissionError(f"Missing scope {scope}")
