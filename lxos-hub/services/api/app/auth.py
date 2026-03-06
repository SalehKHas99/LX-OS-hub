"""
Authentication: email/password + Google OAuth + session tokens.
JWT-less: sessions stored in DB with hashed tokens.
"""
import hashlib, os, secrets, time
from datetime import datetime, timedelta, timezone
import requests as http

from app.db import get_conn
from app.config import JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

SESSION_TTL_DAYS = 30

# ── Helpers ───────────────────────────────────────────────────

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def _hash_password(pw: str) -> str:
    import hashlib
    salt = JWT_SECRET[:16] or "lxos_default_salt"
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 260_000).hex()

def _verify_password(pw: str, stored_hash: str) -> bool:
    return _hash_password(pw) == stored_hash

def create_session(user_id: str, user_agent: str = "", ip: str = "") -> str:
    """Create a session, return raw token."""
    token = f"lxos_sess_{secrets.token_hex(32)}"
    token_hash = _hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO auth_sessions (user_id, token_hash, expires_at, user_agent, ip) "
                "VALUES (%s,%s,%s,%s,%s)",
                (user_id, token_hash, expires_at, user_agent, ip)
            )
        conn.commit()
    return token

def validate_session(token: str) -> dict | None:
    """Validate session token. Returns user row or None."""
    token_hash = _hash_token(token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT s.user_id, u.email, u.username, u.display_name, u.avatar_url, u.auth_provider "
                "FROM auth_sessions s "
                "JOIN users u ON u.id = s.user_id "
                "WHERE s.token_hash = %s AND s.expires_at > now()",
                (token_hash,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return {"user_id": str(row[0]), "email": row[1], "username": row[2],
                    "display_name": row[3], "avatar_url": row[4], "auth_provider": row[5]}

def revoke_session(token: str):
    token_hash = _hash_token(token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM auth_sessions WHERE token_hash=%s", (token_hash,))
        conn.commit()

# ── Email / Password ──────────────────────────────────────────

def register_email(email: str, password: str, username: str = "") -> dict:
    """Register a new user. Returns user dict."""
    pw_hash = _hash_password(password)
    uname = username or email.split("@")[0]
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email=%s", (email,))
            if cur.fetchone():
                raise ValueError("Email already registered")
            cur.execute(
                "INSERT INTO users (email, username, password_hash, auth_provider, email_verified) "
                "VALUES (%s,%s,%s,'email',FALSE) RETURNING id",
                (email, uname, pw_hash)
            )
            user_id = str(cur.fetchone()[0])
            # Auto-create personal org
            slug = f"org-{user_id[:8]}"
            cur.execute(
                "INSERT INTO organizations (name, slug) VALUES (%s,%s) ON CONFLICT (slug) DO NOTHING RETURNING id",
                (uname + "'s Workspace", slug)
            )
            row = cur.fetchone()
            if row:
                org_id = row[0]
            else:
                cur.execute("SELECT id FROM organizations WHERE slug=%s", (slug,))
                org_id = cur.fetchone()[0]
            cur.execute(
                "INSERT INTO memberships (org_id, user_id, role) VALUES (%s,%s,'owner') ON CONFLICT DO NOTHING",
                (org_id, user_id)
            )
        conn.commit()
    return {"user_id": user_id, "email": email, "username": uname}

def login_email(email: str, password: str) -> str | None:
    """Verify credentials and return raw session token, or None."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, password_hash FROM users WHERE email=%s AND auth_provider='email'", (email,))
            row = cur.fetchone()
            if not row:
                return None
            user_id, pw_hash = row
            if not pw_hash or not _verify_password(password, pw_hash):
                return None
    return create_session(str(user_id))

# ── Google OAuth ──────────────────────────────────────────────

def google_auth_url(redirect_uri: str, state: str = "") -> str:
    """Build Google OAuth2 authorization URL."""
    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID not configured")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state or secrets.token_hex(16),
        "prompt": "select_account",
    }
    from urllib.parse import urlencode
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

def google_exchange_code(code: str, redirect_uri: str) -> dict:
    """Exchange OAuth code for tokens, upsert user, return session token."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise ValueError("Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET")

    # Exchange code for tokens
    resp = http.post("https://oauth2.googleapis.com/token", data={
        "code": code, "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri, "grant_type": "authorization_code",
    }, timeout=10)
    resp.raise_for_status()
    tokens = resp.json()

    # Get user info
    userinfo = http.get("https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {tokens['access_token']}"}, timeout=10).json()

    google_id = userinfo["sub"]
    email = userinfo.get("email", "")
    name = userinfo.get("name", "")
    avatar = userinfo.get("picture", "")
    username = email.split("@")[0] if email else f"user_{google_id[:8]}"

    with get_conn() as conn:
        with conn.cursor() as cur:
            # Upsert by google_id
            cur.execute("SELECT id FROM users WHERE google_id=%s", (google_id,))
            row = cur.fetchone()
            if row:
                user_id = str(row[0])
                cur.execute(
                    "UPDATE users SET avatar_url=%s, display_name=%s, email_verified=TRUE WHERE id=%s",
                    (avatar, name, user_id)
                )
            else:
                # Check if email exists (link accounts)
                cur.execute("SELECT id FROM users WHERE email=%s", (email,))
                existing = cur.fetchone()
                if existing:
                    user_id = str(existing[0])
                    cur.execute(
                        "UPDATE users SET google_id=%s, avatar_url=%s, display_name=%s, email_verified=TRUE WHERE id=%s",
                        (google_id, avatar, name, user_id)
                    )
                else:
                    cur.execute(
                        "INSERT INTO users (email, username, google_id, avatar_url, display_name, auth_provider, email_verified) "
                        "VALUES (%s,%s,%s,%s,%s,'google',TRUE) RETURNING id",
                        (email, username, google_id, avatar, name)
                    )
                    user_id = str(cur.fetchone()[0])
                    # Auto-create org
                    slug = f"org-{user_id[:8]}"
                    cur.execute(
                        "INSERT INTO organizations (name, slug) VALUES (%s,%s) ON CONFLICT (slug) DO NOTHING RETURNING id",
                        (f"{name or username}'s Workspace", slug)
                    )
                    row2 = cur.fetchone()
                    if row2:
                        cur.execute(
                            "INSERT INTO memberships (org_id, user_id, role) VALUES (%s,%s,'owner') ON CONFLICT DO NOTHING",
                            (row2[0], user_id)
                        )
        conn.commit()

    session_token = create_session(user_id)
    return {"session_token": session_token, "user_id": user_id, "email": email,
            "display_name": name, "avatar_url": avatar}

# ── Password reset ────────────────────────────────────────────

def create_reset_token(email: str) -> str | None:
    """Create a password reset token. Returns token or None if email not found."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email=%s AND auth_provider='email'", (email,))
            row = cur.fetchone()
            if not row:
                return None
            user_id = row[0]
            token = secrets.token_urlsafe(32)
            token_hash = _hash_token(token)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
            cur.execute(
                "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (%s,%s,%s)",
                (user_id, token_hash, expires_at)
            )
        conn.commit()
    return token

def use_reset_token(token: str, new_password: str) -> bool:
    """Use a reset token to set new password. Returns True on success."""
    token_hash = _hash_token(token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, user_id FROM password_reset_tokens WHERE token_hash=%s AND expires_at>now() AND used_at IS NULL",
                (token_hash,)
            )
            row = cur.fetchone()
            if not row:
                return False
            reset_id, user_id = row
            pw_hash = _hash_password(new_password)
            cur.execute("UPDATE users SET password_hash=%s WHERE id=%s", (pw_hash, user_id))
            cur.execute("UPDATE password_reset_tokens SET used_at=now() WHERE id=%s", (reset_id,))
        conn.commit()
    return True
