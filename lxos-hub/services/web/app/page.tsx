"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Shell from "./_components/Shell";
import { apiGet, apiPost } from "./_components/api";

export default function HomePage() {
  const [featured, setFeatured] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [recs, setRecs] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet("/search?sort=benchmark&limit=6").then(d => setFeatured(d.results || [])).catch(() => {});
    apiGet("/recommendations?limit=4").then(d => setRecs(d.items || [])).catch(() => {});
    apiGet("/demo/status").then(setStatus).catch(() => {});
  }, []);

  const search = useCallback(async () => {
    if (!q.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const d = await apiGet(`/search?q=${encodeURIComponent(q)}&mode=hybrid&limit=20`);
      setResults(d.results || []);
    } catch {}
    setLoading(false);
  }, [q]);

  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") search(); };

  const scoreBar = (s: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: "var(--bg-elevated)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Math.round(s * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--mono)", minWidth: 32 }}>{s.toFixed(2)}</span>
    </div>
  );

  const PromptCard = ({ p }: { p: any }) => (
    <Link href={`/library/${p.id}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18, cursor: "pointer", transition: "border-color var(--ease)", height: "100%" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 6 }}>{p.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5, minHeight: 32 }}>{(p.description || "").slice(0, 90) || "No description"}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {(p.tags || []).slice(0, 3).map((t: string) => (
            <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(91,143,245,0.2)" }}>{t}</span>
          ))}
        </div>
        {p.aggregate_score > 0 && scoreBar(Number(p.aggregate_score))}
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
          <span>⑂ {p.fork_count || 0}</span>
          <span>★ {Number(p.avg_rating || 0).toFixed(1)}</span>
          <span style={{ marginLeft: "auto", textTransform: "uppercase", letterSpacing: 0.5 }}>{p.visibility}</span>
        </div>
      </div>
    </Link>
  );

  const sectionHead = (title: string, sub: string) => (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>{title}</h2>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );

  return (
    <Shell title="">
      {/* Hero */}
      <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid var(--border)" }}>
        <div style={{ marginBottom: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase" }}>LX-OS Hub</div>
        <h1 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 900, letterSpacing: -1, lineHeight: 1.1 }}>
          Build, test & share<br />
          <span style={{ color: "var(--accent)" }}>auditable prompt systems</span>
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-muted)", maxWidth: 520, lineHeight: 1.6 }}>
          LX-DSL prompt engineering with versioning, lint suggestions, benchmark scoring, and auto-optimization. Open and forkable.
        </p>

        {/* Search bar */}
        <div style={{ display: "flex", gap: 0, maxWidth: 560 }}>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search prompts — try 'summarizer' or 'email assistant'…"
            style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRight: "none", borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)", padding: "11px 16px", color: "var(--text)", fontSize: 13, outline: "none" }} />
          <button onClick={search} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "0 var(--radius-sm) var(--radius-sm) 0", padding: "0 22px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
            Search
          </button>
        </div>

        {/* Status pills */}
        {status && (
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: `${status.prompts} prompts`, icon: "◈" },
              { label: `${status.runs} runs`, icon: "▶" },
              { label: `${status.active_keys} active keys`, icon: "⚿" },
            ].map(p => (
              <span key={p.label} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 999, background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
                {p.icon} {p.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Search results */}
      {searched && (
        <div style={{ marginBottom: 40 }}>
          {sectionHead("Search Results", loading ? "Searching…" : `${results.length} prompts found`)}
          {loading
            ? <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Searching…</div>
            : results.length === 0
              ? <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No prompts found for "{q}" — <Link href="/app" style={{ color: "var(--accent)" }}>build one</Link>.</div>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {results.map(p => <PromptCard key={p.id} p={p} />)}
                </div>
          }
        </div>
      )}

      {/* Featured (top benchmark scores) */}
      {!searched && featured.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          {sectionHead("Top Performing Prompts", "Ranked by benchmark score")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {featured.map(p => <PromptCard key={p.id} p={p} />)}
          </div>
          <Link href="/library" style={{ display: "inline-block", marginTop: 14, fontSize: 12, color: "var(--accent)" }}>Browse full library →</Link>
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          {sectionHead("Recommended for You", "Based on your run history and tag overlap")}
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {recs.map(p => (
              <Link key={p.id} href={`/library/${p.id}`} style={{ textDecoration: "none", flexShrink: 0, width: 220 }}>
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>{(p.description || "").slice(0, 60)}</div>
                  <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--text-dim)" }}>
                    <span>⑂ {p.fork_count || 0}</span>
                    <span>★ {Number(p.avg_rating || 0).toFixed(1)}</span>
                    {p.tag_overlap > 0 && <span style={{ color: "var(--accent)" }}>+{p.tag_overlap} tags</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick-start CTA row */}
      {!searched && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 28 }}>
          {[
            { href: "/app", icon: "✏", label: "Build a Prompt", sub: "DSL editor + live lint" },
            { href: "/library", icon: "◈", label: "Browse Library", sub: "Search + fork prompts" },
            { href: "/lab", icon: "▶", label: "Run in Lab", sub: "Test any prompt version" },
            { href: "/benchmarks", icon: "⚡", label: "Benchmark", sub: "Score + compare" },
            { href: "/optimize", icon: "↑", label: "Optimize", sub: "Auto-improve variants" },
            { href: "/setup", icon: "⚿", label: "Setup", sub: "API keys + bootstrap" },
          ].map(c => (
            <Link key={c.href} href={c.href} style={{ textDecoration: "none" }}>
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{c.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
