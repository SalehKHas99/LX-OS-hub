"""
Theme & site config CRUD + image upload handling.
All theme tokens are DB-persisted; CSS vars are served via /api/theme/css.
Images are stored on disk with SHA256-hashed filenames + DB record.
"""
import hashlib, os, uuid, mimetypes
from pathlib import Path
from app.db import get_conn

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5MB

GOOGLE_FONTS = [
    "Syne", "IBM Plex Mono", "Space Grotesk", "DM Sans", "DM Mono",
    "JetBrains Mono", "Fira Code", "Inter", "Outfit", "Raleway",
    "Playfair Display", "Bebas Neue", "Oswald", "Roboto Mono",
]


# ── Site config ───────────────────────────────────────────────

def get_all_config() -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT key, value, label, group_name, value_type, options FROM site_config ORDER BY group_name, key")
            rows = cur.fetchall()
    result = {}
    for key, value, label, group, vtype, options in rows:
        result[key] = {"value": value, "label": label, "group": group,
                       "type": vtype, "options": options or []}
    return result

def get_config_flat() -> dict[str, str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT key, value FROM site_config")
            return {r[0]: r[1] for r in cur.fetchall()}

def set_config(key: str, value: str, user_id: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE site_config SET value=%s, updated_by=%s, updated_at=now() WHERE key=%s",
                (value, user_id, key)
            )
            updated = cur.rowcount > 0
        conn.commit()
    return updated

def set_config_bulk(updates: dict[str, str], user_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            for key, value in updates.items():
                cur.execute(
                    "UPDATE site_config SET value=%s, updated_by=%s, updated_at=now() WHERE key=%s",
                    (value, user_id, key)
                )
        conn.commit()


# ── Theme CRUD ────────────────────────────────────────────────

def list_themes() -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, slug, is_default, is_builtin, tokens, created_at "
                "FROM themes ORDER BY is_builtin DESC, is_default DESC, name"
            )
            return [
                {"id": str(r[0]), "name": r[1], "slug": r[2], "is_default": r[3],
                 "is_builtin": r[4], "tokens": r[5], "created_at": str(r[6])}
                for r in cur.fetchall()
            ]

def get_active_theme() -> dict:
    """Return the active theme tokens merged with site_config overrides."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT tokens FROM themes WHERE is_default=TRUE LIMIT 1")
            row = cur.fetchone()
            base_tokens = dict(row[0]) if row else {}
            # site_config color/font/radius overrides take precedence
            cur.execute("SELECT key, value FROM site_config WHERE group_name IN ('theme_colors','theme_fonts','theme_shape')")
            for key, value in cur.fetchall():
                base_tokens[key] = value
    return base_tokens

def create_theme(name: str, slug: str, tokens: dict, user_id: str) -> str:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO themes (name, slug, tokens, created_by) VALUES (%s,%s,%s::jsonb,%s) RETURNING id",
                (name, slug, __import__('json').dumps(tokens), user_id)
            )
            theme_id = str(cur.fetchone()[0])
        conn.commit()
    return theme_id

def update_theme(theme_id: str, updates: dict) -> bool:
    import json
    with get_conn() as conn:
        with conn.cursor() as cur:
            if "tokens" in updates:
                cur.execute(
                    "UPDATE themes SET tokens=%s::jsonb, updated_at=now() WHERE id=%s AND is_builtin=FALSE",
                    (json.dumps(updates["tokens"]), theme_id)
                )
            if "name" in updates:
                cur.execute("UPDATE themes SET name=%s, updated_at=now() WHERE id=%s AND is_builtin=FALSE",
                            (updates["name"], theme_id))
            updated = cur.rowcount > 0
        conn.commit()
    return updated

def delete_theme(theme_id: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM themes WHERE id=%s AND is_builtin=FALSE AND is_default=FALSE", (theme_id,))
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted

def set_default_theme(theme_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE themes SET is_default=FALSE")
            cur.execute("UPDATE themes SET is_default=TRUE WHERE id=%s", (theme_id,))
            # Also sync active theme tokens into site_config
            cur.execute("SELECT tokens FROM themes WHERE id=%s", (theme_id,))
            row = cur.fetchone()
            if row:
                for key, value in (row[0] or {}).items():
                    cur.execute(
                        "UPDATE site_config SET value=%s, updated_at=now() WHERE key=%s",
                        (str(value), key)
                    )
        conn.commit()

def generate_css(tokens: dict) -> str:
    """Generate CSS :root block from token dict."""
    # Token key → CSS var mapping
    mapping = {
        "color_bg":           "--bg",
        "color_bg_panel":     "--bg-panel",
        "color_bg_elevated":  "--bg-elevated",
        "color_bg_hover":     "--bg-hover",
        "color_border":       "--border",
        "color_text":         "--text",
        "color_text_muted":   "--text-muted",
        "color_text_dim":     "--text-dim",
        "color_accent":       "--accent",
        "color_green":        "--green",
        "color_amber":        "--amber",
        "color_red":          "--red",
        "radius_sm":          "--radius-sm",
        "radius_md":          "--radius",
        "radius_lg":          "--radius-lg",
    }
    lines = [":root {"]
    for tk, css_var in mapping.items():
        if tk in tokens:
            lines.append(f"  {css_var}: {tokens[tk]};")
    # Accent glow/dim derived from accent color
    accent = tokens.get("color_accent", "#5b8ff5")
    lines.append(f"  --accent-glow: {accent}2e;")
    lines.append(f"  --accent-dim:  {accent}14;")
    # Font loading
    sans = tokens.get("font_sans", "Syne")
    mono = tokens.get("font_mono", "IBM Plex Mono")
    lines.append(f"  --sans: '{sans}', sans-serif;")
    lines.append(f"  --mono: '{mono}', monospace;")
    lines.append("}")
    # Google Fonts import
    fonts_to_load = list({sans, mono})
    gf_params = "&family=".join(f.replace(" ", "+") + ":wght@400;500;600;700;800" for f in fonts_to_load)
    font_import = f"@import url('https://fonts.googleapis.com/css2?family={gf_params}&display=swap');"
    return font_import + "\n" + "\n".join(lines)


# ── Image uploads ─────────────────────────────────────────────

def save_upload(file_bytes: bytes, original_name: str, mime: str,
                user_id: str, org_id: str, purpose: str = "avatar") -> dict:
    if mime not in ALLOWED_MIME:
        raise ValueError(f"File type not allowed: {mime}")
    if len(file_bytes) > MAX_SIZE_BYTES:
        raise ValueError(f"File too large (max 5MB)")

    # Content-addressed filename: sha256 + original extension
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    ext = Path(original_name).suffix.lower() or mimetypes.guess_extension(mime) or ".bin"
    stored_name = f"{sha256}{ext}"
    dest = UPLOAD_DIR / stored_name

    if not dest.exists():
        dest.write_bytes(file_bytes)

    url_path = f"/uploads/{stored_name}"

    with get_conn() as conn:
        with conn.cursor() as cur:
            # Check if identical file already exists for this user+purpose
            cur.execute(
                "SELECT id, url_path FROM uploads WHERE sha256_hash=%s AND user_id=%s AND purpose=%s",
                (sha256, user_id, purpose)
            )
            existing = cur.fetchone()
            if existing:
                return {"id": str(existing[0]), "url_path": existing[1], "sha256": sha256, "reused": True}

            cur.execute(
                "INSERT INTO uploads (user_id, org_id, filename_original, filename_stored, "
                "mime_type, size_bytes, sha256_hash, purpose, url_path) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (user_id, org_id or None, original_name, stored_name,
                 mime, len(file_bytes), sha256, purpose, url_path)
            )
            upload_id = str(cur.fetchone()[0])

            if purpose == "avatar":
                cur.execute("UPDATE users SET upload_id=%s, avatar_url=%s WHERE id=%s",
                            (upload_id, url_path, user_id))
        conn.commit()

    return {"id": upload_id, "url_path": url_path, "sha256": sha256, "reused": False}

def list_uploads(user_id: str) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, filename_original, mime_type, size_bytes, purpose, url_path, created_at "
                "FROM uploads WHERE user_id=%s ORDER BY created_at DESC",
                (user_id,)
            )
            return [
                {"id": str(r[0]), "filename": r[1], "mime": r[2], "size": r[3],
                 "purpose": r[4], "url": r[5], "created_at": str(r[6])}
                for r in cur.fetchall()
            ]
