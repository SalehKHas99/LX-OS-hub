"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "../_components/Shell";
import { apiGet } from "../_components/api";

export default function MePage() {
  const [me, setMe] = useState<any>(null);
  const [myPrompts, setMyPrompts] = useState<any[]>([]);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);

  useEffect(() => {
    apiGet("/auth/me").then(setMe).catch(() => {});
    apiGet("/prompts?limit=20").then(d => setMyPrompts(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet("/runs?limit=10").then(d => setRecentRuns(Array.isArray(d) ? d : [])).catch(() => {});
    apiGet("/recommendations?limit=6").then(d => setRecs(d.items || [])).catch(() => {});
  }, []);

  const statusColor = (s: string) => s === "succeeded" ? "var(--green)" : s === "failed" || s === "refused" ? "var(--red)" : "var(--amber)";

  return (
    <Shell title="My Profile">
      {/* Identity card */}
      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, marginBottom: 28, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "var(--accent)" }}>
          {me?.user_id?.slice(0, 1).toUpperCase() || "?"}
        </div>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>USER ID</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)" }}>{me?.user_id || "—"}</div>
        </div>
        <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 20 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>ORG</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)" }}>{me?.org_id || "—"}</div>
        </div>
        <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 20 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>ROLE</div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(91,143,245,0.3)", fontFamily: "var(--mono)" }}>{me?.role || "—"}</span>
        </div>
        <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 20 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>SCOPES</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(me?.scopes || []).slice(0, 5).map((s: string) => (
              <span key={s} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", fontFamily: "var(--mono)" }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* My Prompts */}
        <div>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>My Prompts <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{myPrompts.length}</span></h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myPrompts.slice(0, 8).map(p => (
              <Link key={p.id} href={`/library/${p.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.category || p.visibility}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-dim)" }}>
                    <span>⑂ {p.fork_count || 0}</span>
                    {p.aggregate_score > 0 && <span style={{ color: "var(--accent)" }}>⚡{Number(p.aggregate_score).toFixed(2)}</span>}
                  </div>
                </div>
              </Link>
            ))}
            {myPrompts.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No prompts yet — <Link href="/app" style={{ color: "var(--accent)" }}>build one</Link></div>
            )}
          </div>
          <Link href="/app" style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: "var(--accent)" }}>+ New Prompt</Link>
        </div>

        {/* Recent Runs */}
        <div>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Recent Runs</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentRuns.slice(0, 8).map(r => (
              <Link key={r.id} href={`/runs/${r.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{r.id?.slice(0, 8)}…</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{r.model} · {r.provider}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11 }}>
                    {r.latency_ms && <span style={{ color: "var(--text-dim)" }}>{r.latency_ms}ms</span>}
                    <span style={{ color: statusColor(r.status), fontWeight: 700 }}>{r.status}</span>
                  </div>
                </div>
              </Link>
            ))}
            {recentRuns.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No runs yet — <Link href="/lab" style={{ color: "var(--accent)" }}>try the lab</Link></div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Recommended Prompts</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {recs.map(p => (
              <Link key={p.id} href={`/library/${p.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 16px", width: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{p.title}</div>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-dim)" }}>
                    <span>⑂ {p.fork_count || 0}</span>
                    <span>★ {Number(p.avg_rating || 0).toFixed(1)}</span>
                    {p.tag_overlap > 0 && <span style={{ color: "var(--accent)" }}>+{p.tag_overlap}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
