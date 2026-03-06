"use client";
import React, { useState, useEffect } from "react";
import Shell from "../_components/Shell";
import { apiGet, apiPost } from "../_components/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function StudioPage() {
  const [tab, setTab] = useState<"audit"|"outbox"|"analytics">("audit");
  const [audit, setAudit] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any>({});
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, [tab]);

  async function load() {
    setLoading(true);
    try {
      if (tab === "audit") { const d = await apiGet("/audit?limit=100"); setAudit(d); }
      if (tab === "outbox") { const d = await apiGet("/outbox/stats"); setOutbox(d); }
      if (tab === "analytics") { const d = await apiGet("/analytics/runs"); setAnalytics(d); }
    } catch {}
    setLoading(false);
  }

  async function dispatch() {
    setMsg("");
    await apiPost("/outbox/dispatch");
    setMsg("✓ Dispatch queued");
    setTimeout(() => load(), 1500);
  }

  const tabStyle = (t: string) => ({
    padding: "8px 16px", cursor: "pointer", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600,
    background: tab === t ? "var(--bg-elevated)" : "transparent",
    color: tab === t ? "var(--text)" : "var(--text-muted)",
    border: "1px solid " + (tab === t ? "var(--border)" : "transparent"),
  });

  return (
    <Shell title="Governance Studio">
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button style={tabStyle("audit")} onClick={() => setTab("audit")}>Audit Log</button>
        <button style={tabStyle("outbox")} onClick={() => setTab("outbox")}>Outbox</button>
        <button style={tabStyle("analytics")} onClick={() => setTab("analytics")}>Analytics</button>
      </div>

      {loading && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>}

      {tab === "audit" && !loading && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["Time","Action","Resource","Resource ID","Actor"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.map((a, i) => (
                <tr key={a.id || i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "9px 12px", fontFamily: "var(--mono)", color: "var(--text-muted)" }}>{new Date(a.created_at).toLocaleString()}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "var(--accent)" }}>{a.action}</td>
                  <td style={{ padding: "9px 12px" }}>{a.resource}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{a.resource_id?.slice(0,8)}…</td>
                  <td style={{ padding: "9px 12px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{a.actor_id?.slice(0,8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>No audit entries</div>}
        </div>
      )}

      {tab === "outbox" && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {Object.entries(outbox).map(([k, v]) => (
              <div key={k} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--accent)" }}>{String(v)}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{k}</div>
              </div>
            ))}
          </div>
          <button onClick={dispatch} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "10px 20px", cursor: "pointer", fontWeight: 600, width: "fit-content" }}>
            Dispatch Outbox
          </button>
          {msg && <div style={{ color: "var(--green)", fontSize: 13 }}>{msg}</div>}
        </div>
      )}

      {tab === "analytics" && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a
              href={`${API_BASE}/analytics/runs/export`}
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 16px", color: "var(--text)", fontSize: 13, textDecoration: "none", fontWeight: 600 }}
            >
              Export CSV
            </a>
          </div>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  {["Day","Total","Succeeded","Failed","Avg Latency (ms)","Cost (USD)"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "9px 12px", fontFamily: "var(--mono)" }}>{r.day?.slice(0,10)}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 600 }}>{r.total}</td>
                    <td style={{ padding: "9px 12px", color: "var(--green)" }}>{r.succeeded}</td>
                    <td style={{ padding: "9px 12px", color: "var(--red)" }}>{r.failed}</td>
                    <td style={{ padding: "9px 12px", fontFamily: "var(--mono)" }}>{Number(r.avg_latency_ms).toFixed(0)}</td>
                    <td style={{ padding: "9px 12px", fontFamily: "var(--mono)" }}>${Number(r.total_cost_usd).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analytics.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>No analytics data yet</div>}
          </div>
        </div>
      )}
    </Shell>
  );
}
