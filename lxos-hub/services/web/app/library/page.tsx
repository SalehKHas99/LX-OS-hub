"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Shell from "../_components/Shell";
import { apiGet, apiPost } from "../_components/api";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function LibraryPage() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("recent");
  const [mode, setMode] = useState("keyword");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, tags, category, sort, mode, limit: "40" });
      const data = await apiGet(`/search?${params}`);
      setPrompts(data.results || data);
    } catch (e: any) { setMsg(String(e)); }
    setLoading(false);
  }, [q, tags, category, sort]);

  useEffect(() => { load(); }, [load]);

  async function fork(promptId: string) {
    setMsg("");
    try {
      const r = await apiPost(`/prompts/${promptId}/fork`);
      setMsg(`✓ Forked → ${r.id.slice(0,8)}`);
      load();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  const sortColor = (s: string) => s === sort ? "var(--accent)" : "var(--text-muted)";

  return (
    <Shell title="Prompt Library">
      {/* Search + filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search prompts…"
          style={{ flex: "1 1 240px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 14px", color: "var(--text)", fontSize: 13 }} />
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (comma-sep)"
          style={{ width: 160, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 12 }} />
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Category"
          style={{ width: 130, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 12 }} />
        <select value={mode} onChange={e => setMode(e.target.value)}
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 10px", color: "var(--text)", fontSize: 12 }}>
          <option value="keyword">Keyword</option>
          <option value="semantic">Semantic</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sort:</span>
          {["recent","forks","rating","benchmark"].map(s => (
            <button key={s} onClick={() => setSort(s)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: sort===s ? "var(--accent-dim)" : "var(--bg-elevated)", color: sortColor(s), cursor: "pointer" }}>{s}</button>
          ))}
        </div>
      </div>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</div>}
      {loading && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Searching…</div>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {prompts.map(p => (
            <div key={p.id} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <Link href={`/library/${p.id}`} style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", flex: 1 }}>{p.title}</Link>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", marginLeft: 8 }}>{p.visibility}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>{p.description?.slice(0,100) || "No description"}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {(p.tags || []).slice(0,4).map((t: string) => (
                  <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(91,143,245,0.3)" }}>{t}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
                <span>⑂ {p.fork_count || 0}</span>
                <span>★ {Number(p.avg_rating || 0).toFixed(1)}</span>
                {p.aggregate_score > 0 && <span>⚡ {Number(p.aggregate_score).toFixed(2)}</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/library/${p.id}`} style={{ fontSize: 11, padding: "5px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)" }}>View</Link>
                <button onClick={() => fork(p.id)} style={{ fontSize: 11, padding: "5px 12px", background: "transparent", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)", color: "var(--accent)", cursor: "pointer" }}>Fork</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && prompts.length === 0 && <div style={{ color: "var(--text-muted)", textAlign: "center", paddingTop: 40 }}>No prompts found</div>}
    </Shell>
  );
}
