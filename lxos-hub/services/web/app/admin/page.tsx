"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../_components/Shell";
import { useTheme } from "../_components/ThemeProvider";
import AdminGuard from "../_components/AdminGuard";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function authHeaders() {
  const k = typeof window !== "undefined" ? localStorage.getItem("lxos_api_key") : null;
  return { "content-type": "application/json", ...(k ? { authorization: `Bearer ${k}` } : {}) };
}
async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers as any || {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── Colour swatch picker ───────────────────────────────────
function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 34, height: 34, borderRadius: 8, overflow: "hidden",
        border: "2px solid var(--border)", cursor: "pointer", flexShrink: 0 }}>
        <div style={{ width: "100%", height: "100%", background: value }} />
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
      </div>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 12, background: "var(--bg-elevated)",
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px",
          color: "var(--text)", outline: "none" }} />
    </div>
  );
}

// ─── Section card ────────────────────────────────────────────
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", marginBottom: 20, overflow: "hidden" }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{sub}</div>}
      </div>
      <div style={{ padding: "20px 22px" }}>{children}</div>
    </div>
  );
}

// ─── Tab button ──────────────────────────────────────────────
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "9px 18px", fontWeight: active ? 700 : 500, fontSize: 13,
      background: active ? "var(--accent)" : "var(--bg-elevated)",
      color: active ? "#fff" : "var(--text-muted)",
      border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
      borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 120ms",
    }}>{label}</button>
  );
}

// ─── Toast ───────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: type === "ok" ? "var(--green)" : "var(--red)",
      color: "#000", padding: "10px 20px", borderRadius: "var(--radius-sm)",
      fontWeight: 700, fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      animation: "fadeUp 200ms ease",
    }}>{msg}</div>
  );
}

// ── Main Admin Page ──────────────────────────────────────────
type ConfigMap = Record<string, { value: string; label: string; group: string; type: string; options?: string[] }>;
type Theme = { id: string; name: string; slug: string; is_default: boolean; is_builtin: boolean; tokens: Record<string, string> };

const COLOR_KEYS = [
  { k: "color_bg",          l: "Background" },
  { k: "color_bg_panel",    l: "Panel" },
  { k: "color_bg_elevated", l: "Elevated" },
  { k: "color_bg_hover",    l: "Hover" },
  { k: "color_border",      l: "Border" },
  { k: "color_text",        l: "Text" },
  { k: "color_text_muted",  l: "Muted Text" },
  { k: "color_text_dim",    l: "Dim Text" },
  { k: "color_accent",      l: "Accent" },
  { k: "color_green",       l: "Success" },
  { k: "color_amber",       l: "Warning" },
  { k: "color_red",         l: "Danger" },
];

const FONT_OPTIONS = [
  "Syne","Space Grotesk","DM Sans","Outfit","Raleway","Oswald","Bebas Neue","Playfair Display",
  "IBM Plex Mono","JetBrains Mono","Fira Code","DM Mono","Roboto Mono",
];

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  );
}

function AdminDashboard() {
  const theme = useTheme();
  const [tab, setTab] = useState<"branding"|"theme"|"themes"|"navigation"|"users"|"uploads">("branding");
  const [config, setConfig] = useState<ConfigMap>({});
  const [themes, setThemes] = useState<Theme[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [themeDraft, setThemeDraft] = useState<Record<string, string>>({});
  const [newThemeName, setNewThemeName] = useState("");
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "ok"|"err" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPurpose, setUploadPurpose] = useState("avatar");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "ok"|"err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    try {
      const [cfg, th] = await Promise.all([apiFetch("/admin/config"), apiFetch("/admin/themes")]);
      setConfig(cfg);
      setThemes(th);
      const flat: Record<string,string> = {};
      for (const [k, v] of Object.entries(cfg as ConfigMap)) flat[k] = v.value;
      setDraft(flat);
    } catch (e: any) { showToast(e.message, "err"); }
  }, []);

  const loadUsers = useCallback(async () => {
    try { setUsers(await apiFetch("/members")); } catch {}
  }, []);

  const loadUploads = useCallback(async () => {
    try { setUploads(await apiFetch("/admin/uploads")); } catch {}
  }, []);

  useEffect(() => {
    load();
    loadUsers();
    loadUploads();
  }, [load, loadUsers, loadUploads]);

  const saveConfig = async (keys?: string[]) => {
    setSaving(true);
    const payload = keys ? Object.fromEntries(keys.map(k => [k, draft[k]])) : draft;
    try {
      await apiFetch("/admin/config", { method: "PATCH", body: JSON.stringify(payload) });
      await load();
      theme.refresh();
      showToast("Saved ✓");
    } catch (e: any) { showToast(e.message, "err"); }
    setSaving(false);
  };

  const activateTheme = async (id: string) => {
    try {
      await apiFetch(`/admin/themes/${id}/activate`, { method: "POST" });
      await load(); theme.refresh();
      showToast("Theme activated ✓");
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const deleteTheme = async (id: string) => {
    if (!confirm("Delete this theme?")) return;
    try {
      await apiFetch(`/admin/themes/${id}`, { method: "DELETE" });
      await load();
      showToast("Theme deleted");
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const saveNewTheme = async () => {
    if (!newThemeName.trim()) return;
    try {
      await apiFetch("/admin/themes", { method: "POST", body: JSON.stringify({
        name: newThemeName.trim(),
        slug: newThemeName.trim().toLowerCase().replace(/\s+/g, "-"),
        tokens: themeDraft,
      })});
      setNewThemeName(""); setThemeDraft({});
      await load();
      showToast("Theme created ✓");
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const saveEditTheme = async () => {
    if (!editingTheme) return;
    try {
      await apiFetch(`/admin/themes/${editingTheme.id}`, { method: "PATCH",
        body: JSON.stringify({ name: editingTheme.name, tokens: editingTheme.tokens })});
      setEditingTheme(null);
      await load(); theme.refresh();
      showToast("Theme updated ✓");
    } catch (e: any) { showToast(e.message, "err"); }
  };

  const handleFileSelect = (f: File | null) => {
    setUploadFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else setPreview(null);
  };

  const doUpload = async () => {
    if (!uploadFile) return;
    setSaving(true);
    const key = typeof window !== "undefined" ? localStorage.getItem("lxos_api_key") : null;
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("purpose", uploadPurpose);
    try {
      const r = await fetch(`${API}/upload`, {
        method: "POST",
        headers: key ? { authorization: `Bearer ${key}` } : {},
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setUploadFile(null); setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadUploads();
      showToast(`Uploaded ✓ SHA: ${data.sha256?.slice(0,12)}…`);
    } catch (e: any) { showToast(e.message, "err"); }
    setSaving(false);
  };

  // ─── inline field helpers ──────────────────────────────────
  const field = (key: string, placeholder = "") => (
    <input
      value={draft[key] ?? ""}
      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
      placeholder={placeholder}
      style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13,
        outline: "none", boxSizing: "border-box" }}
    />
  );

  const toggle = (key: string) => (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <div onClick={() => setDraft(d => ({ ...d, [key]: d[key] === "true" ? "false" : "true" }))}
        style={{ width: 42, height: 24, borderRadius: 12, transition: "background 200ms",
          background: draft[key] === "true" ? "var(--accent)" : "var(--bg-elevated)",
          border: "1px solid var(--border)", position: "relative", cursor: "pointer" }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 2,
          left: draft[key] === "true" ? 20 : 2, transition: "left 200ms" }} />
      </div>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {draft[key] === "true" ? "Visible" : "Hidden"}
      </span>
    </label>
  );

  const row = (label: string, content: React.ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 16,
      alignItems: "center", paddingBottom: 14, marginBottom: 14,
      borderBottom: "1px solid var(--border-soft)" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
      <div>{content}</div>
    </div>
  );

  const themeColorEditor = (
    tokens: Record<string, string>,
    onChange: (k: string, v: string) => void
  ) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {COLOR_KEYS.map(({ k, l }) => (
        <div key={k}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>{l}</div>
          <ColorSwatch value={tokens[k] ?? "#000000"}
            onChange={v => onChange(k, v)} />
        </div>
      ))}
    </div>
  );

  return (
    <Shell title="">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>
            ⚙ Admin Dashboard
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            Customise branding, themes, navigation and manage users — all persisted to database.
          </p>
        </div>
        {saving && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
            Saving…
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 26, flexWrap: "wrap" }}>
        {(["branding","theme","themes","navigation","users","uploads"] as const).map(t => (
          <Tab key={t} label={t.charAt(0).toUpperCase() + t.slice(1)}
            active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>

      {/* ═══ BRANDING TAB ════════════════════════════════════ */}
      {tab === "branding" && (
        <>
          <Card title="Site Identity" sub="Shown in the sidebar, browser tab, and meta tags">
            {row("Site Name", field("site_name", "LX-OS Hub"))}
            {row("Tagline", field("site_tagline", "AI Prompt Engineering Workspace"))}
            {row("Logo URL", (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {field("site_logo_url", "https://…/logo.png")}
                {draft.site_logo_url && (
                  <img src={draft.site_logo_url} alt="logo preview"
                    style={{ height: 40, objectFit: "contain", borderRadius: 6,
                      border: "1px solid var(--border)", padding: 4, background: "var(--bg-elevated)" }} />
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button onClick={() => saveConfig(["site_name","site_tagline","site_logo_url"])} disabled={saving}
                style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
                  padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                Save Branding
              </button>
            </div>
          </Card>

          <Card title="Typography" sub="Font families loaded from Google Fonts">
            {row("Body Font", (
              <select value={draft.font_sans ?? "Syne"}
                onChange={e => setDraft(d => ({ ...d, font_sans: e.target.value }))}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                {FONT_OPTIONS.filter(f => !["IBM Plex Mono","JetBrains Mono","Fira Code","DM Mono","Roboto Mono"].includes(f)).map(f => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </select>
            ))}
            {row("Mono Font", (
              <select value={draft.font_mono ?? "IBM Plex Mono"}
                onChange={e => setDraft(d => ({ ...d, font_mono: e.target.value }))}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                {["IBM Plex Mono","JetBrains Mono","Fira Code","DM Mono","Roboto Mono"].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ))}
            {row("Border Radius SM", field("radius_sm", "6px"))}
            {row("Border Radius MD", field("radius_md", "10px"))}
            {row("Border Radius LG", field("radius_lg", "16px"))}
            <button onClick={() => saveConfig(["font_sans","font_mono","radius_sm","radius_md","radius_lg"])}
              disabled={saving}
              style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
                padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              Save Typography
            </button>
          </Card>
        </>
      )}

      {/* ═══ THEME (live colours) TAB ═════════════════════════ */}
      {tab === "theme" && (
        <Card title="Active Theme Colours"
          sub="These override the selected theme preset and apply immediately site-wide">
          {themeColorEditor(
            draft,
            (k, v) => setDraft(d => ({ ...d, [k]: v }))
          )}
          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => saveConfig(COLOR_KEYS.map(c => c.k))} disabled={saving}
              style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
                padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              Apply Colours
            </button>
            <div style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
              Changes reflect on all pages immediately — no rebuild needed.
            </div>
          </div>

          {/* Live preview strip */}
          <div style={{ marginTop: 22, padding: 16, borderRadius: "var(--radius)",
            border: "1px dashed var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, fontWeight: 600 }}>
              PREVIEW
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["color_bg","color_bg_panel","color_bg_elevated","color_accent","color_green","color_amber","color_red"].map(k => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: draft[k] || "#888",
                    border: "1px solid var(--border)", marginBottom: 4 }} />
                  <div style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--mono)",
                    maxWidth: 50, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {k.replace("color_","").replace(/_/g," ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ═══ THEME PRESETS TAB ════════════════════════════════ */}
      {tab === "themes" && (
        <>
          {/* Preset grid */}
          <Card title="Theme Presets" sub="Select, edit or delete saved themes">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
              {themes.map(t => (
                <div key={t.id} style={{
                  background: "var(--bg-elevated)", border: `2px solid ${t.is_default ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "var(--radius)", padding: 16, position: "relative",
                }}>
                  {t.is_default && (
                    <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, padding: "2px 8px",
                      background: "var(--accent)", color: "#fff", borderRadius: 999, fontWeight: 700 }}>
                      ACTIVE
                    </div>
                  )}
                  {/* Colour swatches */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                    {["color_bg","color_bg_panel","color_accent","color_green","color_red"].map(k => (
                      <div key={k} style={{ width: 18, height: 18, borderRadius: 4,
                        background: t.tokens[k] || "#888", border: "1px solid rgba(255,255,255,0.1)" }} />
                    ))}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--mono)",
                    marginBottom: 12 }}>
                    {t.is_builtin ? "built-in" : "custom"} · /{t.slug}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!t.is_default && (
                      <button onClick={() => activateTheme(t.id)}
                        style={{ fontSize: 11, padding: "5px 12px", background: "var(--accent)", color: "#fff",
                          border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 700 }}>
                        Activate
                      </button>
                    )}
                    {!t.is_builtin && (
                      <button onClick={() => setEditingTheme({ ...t, tokens: { ...t.tokens } })}
                        style={{ fontSize: 11, padding: "5px 12px", background: "transparent",
                          color: "var(--text-muted)", border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                        Edit
                      </button>
                    )}
                    {!t.is_builtin && !t.is_default && (
                      <button onClick={() => deleteTheme(t.id)}
                        style={{ fontSize: 11, padding: "5px 12px", background: "transparent",
                          color: "var(--red)", border: "1px solid var(--red)33",
                          borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Edit theme modal */}
          {editingTheme && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
              display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: 28, width: 560, maxHeight: "90vh",
                overflowY: "auto" }}>
                <h2 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 800 }}>Edit Theme</h2>
                <input value={editingTheme.name}
                  onChange={e => setEditingTheme(t => t ? { ...t, name: e.target.value } : t)}
                  placeholder="Theme name"
                  style={{ width: "100%", marginBottom: 18, background: "var(--bg-elevated)",
                    border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                    padding: "9px 12px", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
                {themeColorEditor(
                  editingTheme.tokens,
                  (k, v) => setEditingTheme(t => t ? { ...t, tokens: { ...t.tokens, [k]: v } } : t)
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button onClick={saveEditTheme}
                    style={{ flex: 1, background: "var(--accent)", color: "#fff", border: "none",
                      borderRadius: "var(--radius-sm)", padding: 12, cursor: "pointer", fontWeight: 700 }}>
                    Save Theme
                  </button>
                  <button onClick={() => setEditingTheme(null)}
                    style={{ flex: 1, background: "var(--bg-elevated)", color: "var(--text)",
                      border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                      padding: 12, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create new theme */}
          <Card title="Create Custom Theme" sub="Capture current colours as a reusable named preset">
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input value={newThemeName} onChange={e => setNewThemeName(e.target.value)}
                placeholder="Theme name, e.g. 'Ocean Dark'"
                style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }} />
              <button onClick={() => setThemeDraft({ ...draft })}
                style={{ fontSize: 12, padding: "9px 16px", background: "var(--bg-elevated)",
                  color: "var(--text-muted)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                Copy Current
              </button>
            </div>
            {Object.keys(themeDraft).length > 0 && themeColorEditor(
              themeDraft,
              (k, v) => setThemeDraft(d => ({ ...d, [k]: v }))
            )}
            <button onClick={saveNewTheme} disabled={!newThemeName.trim()}
              style={{ marginTop: 16, background: "var(--accent)", color: "#fff", border: "none",
                borderRadius: "var(--radius-sm)", padding: "10px 24px", cursor: "pointer",
                fontWeight: 700, fontSize: 13, opacity: !newThemeName.trim() ? 0.5 : 1 }}>
              Create Theme
            </button>
          </Card>
        </>
      )}

      {/* ═══ NAVIGATION TAB ═══════════════════════════════════ */}
      {tab === "navigation" && (
        <Card title="Navigation Visibility"
          sub="Toggle which sections appear in the sidebar for all users">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[
              { k: "nav_show_feed",    l: "Community Feed",  desc: "Posts, comments and social" },
              { k: "nav_show_library", l: "Prompt Library",  desc: "Browse and search prompts" },
              { k: "nav_show_lab",     l: "Testing Lab",     desc: "Run prompts interactively" },
              { k: "nav_show_bench",   l: "Benchmarks",      desc: "Benchmark suites and scores" },
              { k: "nav_show_optimize",l: "Optimizer",       desc: "Auto-optimize prompt variants" },
            ].map(({ k, l, desc }) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{l}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>
                </div>
                {toggle(k)}
              </div>
            ))}
          </div>
          <button onClick={() => saveConfig(["nav_show_feed","nav_show_library","nav_show_lab","nav_show_bench","nav_show_optimize"])}
            disabled={saving}
            style={{ marginTop: 20, background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: "var(--radius-sm)", padding: "10px 24px", cursor: "pointer",
              fontWeight: 700, fontSize: 13 }}>
            Save Navigation
          </button>
        </Card>
      )}

      {/* ═══ USERS TAB ════════════════════════════════════════ */}
      {tab === "users" && (
        <Card title="Members" sub="All organisation members and their roles">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["User","Email","Auth","Role","Joined"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px",
                      fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                      letterSpacing: 0.8, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(users as any[]).map((u, i) => (
                  <tr key={u.id || i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} width={28} height={28}
                            style={{ borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: "50%",
                            background: "var(--accent-dim)", border: "1px solid var(--accent)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
                            {(u.username || u.email || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{u.username || "—"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{u.email || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999,
                        background: "var(--bg-elevated)", border: "1px solid var(--border)",
                        color: "var(--text-muted)" }}>
                        {u.auth_provider || "email"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999,
                        background: u.role === "owner" ? "var(--accent-dim)" : "var(--bg-elevated)",
                        color: u.role === "owner" ? "var(--accent)" : "var(--text-muted)",
                        border: `1px solid ${u.role === "owner" ? "var(--accent)" : "var(--border)"}30` }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: "center",
                    color: "var(--text-muted)", fontSize: 13 }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ═══ UPLOADS TAB ══════════════════════════════════════ */}
      {tab === "uploads" && (
        <>
          <Card title="Upload Image" sub="Images are stored with SHA-256 content hash. Identical files are deduplicated.">
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files[0] || null); }}
                style={{ width: 160, height: 160, borderRadius: "var(--radius)",
                  border: "2px dashed var(--border)", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", cursor: "pointer",
                  background: uploadFile ? "var(--accent-dim)" : "var(--bg-elevated)",
                  transition: "all 200ms", position: "relative", overflow: "hidden" }}>
                {preview ? (
                  <img src={preview} alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius)" }} />
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>↑</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "0 12px" }}>
                      Click or drag &amp; drop<br />PNG, JPG, WEBP, SVG
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => handleFileSelect(e.target.files?.[0] || null)} />
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>PURPOSE</div>
                  <select value={uploadPurpose} onChange={e => setUploadPurpose(e.target.value)}
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                    <option value="avatar">Avatar</option>
                    <option value="logo">Site Logo</option>
                    <option value="banner">Banner</option>
                    <option value="attachment">Attachment</option>
                  </select>
                </div>
                {uploadFile && (
                  <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--bg-elevated)",
                    borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{uploadFile.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {(uploadFile.size / 1024).toFixed(1)} KB · {uploadFile.type}
                    </div>
                  </div>
                )}
                <button onClick={doUpload} disabled={!uploadFile || saving}
                  style={{ background: "var(--accent)", color: "#fff", border: "none",
                    borderRadius: "var(--radius-sm)", padding: "10px 22px",
                    cursor: uploadFile ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 13,
                    opacity: uploadFile ? 1 : 0.5 }}>
                  {saving ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </Card>

          <Card title="Upload Library"
            sub="All uploaded files. SHA-256 hashed, deduplicated, served from /uploads/{hash}.ext">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {uploads.map((u: any) => (
                <div key={u.id} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", overflow: "hidden" }}>
                  <div style={{ height: 120, background: "var(--bg-hover)", display: "flex",
                    alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {u.mime?.startsWith("image/") ? (
                      <img src={`${API}${u.url}`} alt={u.filename}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ fontSize: 28 }}>📎</div>
                    )}
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginBottom: 2 }}>
                      {u.filename}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--mono)",
                      marginBottom: 6 }}>
                      {(u.size / 1024).toFixed(1)} KB
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999,
                        background: "var(--bg-panel)", color: "var(--text-muted)",
                        border: "1px solid var(--border)" }}>
                        {u.purpose}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${API}${u.url}`)}
                        style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999,
                          background: "var(--accent-dim)", color: "var(--accent)",
                          border: "1px solid var(--accent)30", cursor: "pointer" }}>
                        Copy URL
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {uploads.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 32,
                  color: "var(--text-muted)", fontSize: 13 }}>
                  No uploads yet
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Shell>
  );
}
