"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Shell from "../../_components/Shell";
import { apiGet, apiPost } from "../../_components/api";

const statusColor = (s: string) => s === "succeeded" ? "var(--green)" : s === "failed" || s === "refused" ? "var(--red)" : "var(--amber)";

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"output" | "compiled" | "artifacts" | "events">("output");

  useEffect(() => {
    if (!runId) return;
    apiGet(`/runs/${runId}`).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [runId]);

  async function replay() {
    setReplaying(true); setMsg("");
    try {
      const r = await apiPost(`/runs/${runId}/replay`);
      setMsg(`✓ Replay queued: ${r.id?.slice(0, 8)}`);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setReplaying(false);
  }

  if (loading) return <Shell title="Run"><div style={{ color: "var(--text-muted)" }}>Loading…</div></Shell>;
  if (!data) return <Shell title="Run"><div style={{ color: "var(--red)" }}>Not found</div></Shell>;

  const run = data.run || data;
  const events = data.events || [];

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{
      padding: "7px 16px", cursor: "pointer", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600,
      background: tab === t ? "var(--accent)" : "var(--bg-elevated)",
      color: tab === t ? "#fff" : "var(--text-muted)",
      border: "1px solid " + (tab === t ? "var(--accent)" : "var(--border)"),
    }}>{label}</button>
  );

  return (
    <Shell title={`Run ${run.id?.slice(0, 8)}…`}>
      {/* Header metrics */}
      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>STATUS</div>
              <span style={{ fontSize: 15, fontWeight: 800, color: statusColor(run.status) }}>{run.status}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>PROVIDER</div>
              <span style={{ fontSize: 13, fontFamily: "var(--mono)" }}>{run.provider || "—"}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>MODEL</div>
              <span style={{ fontSize: 13, fontFamily: "var(--mono)" }}>{run.model || "—"}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>LATENCY</div>
              <span style={{ fontSize: 13, fontFamily: "var(--mono)" }}>{run.latency_ms != null ? `${run.latency_ms}ms` : "—"}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>TOKENS</div>
              <span style={{ fontSize: 13, fontFamily: "var(--mono)" }}>{run.tokens_in ?? "—"} → {run.tokens_out ?? "—"}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>COST</div>
              <span style={{ fontSize: 13, fontFamily: "var(--mono)" }}>{run.cost_usd ? `$${Number(run.cost_usd).toFixed(6)}` : "—"}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>SAFETY</div>
              <span style={{ fontSize: 13, color: run.safety_outcome === "pass" ? "var(--green)" : "var(--red)" }}>{run.safety_outcome || "—"}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={replay} disabled={replaying} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {replaying ? "Queuing…" : "↺ Replay"}
            </button>
            {msg && <span style={{ fontSize: 12, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</span>}
          </div>
        </div>
      </div>

      {/* Artifact tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabBtn("output", "Output")}
        {run.compiled_prompt && tabBtn("compiled", "Compiled Prompt")}
        {tabBtn("artifacts", "Artifacts")}
        {tabBtn("events", `Events (${events.length})`)}
      </div>

      {tab === "output" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {run.inputs && (
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 1 }}>INPUTS</div>
              <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 12, fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(run.inputs, null, 2)}
              </pre>
            </div>
          )}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 1 }}>OUTPUT</div>
            <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 14, fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "pre-wrap", margin: 0, minHeight: 80 }}>
              {run.output_text || "(no output yet)"}
            </pre>
          </div>
        </div>
      )}

      {tab === "compiled" && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 1 }}>COMPILED PROMPT (inputs substituted)</div>
          <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 14, fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "pre-wrap", margin: 0 }}>
            {run.compiled_prompt}
          </pre>
        </div>
      )}

      {tab === "artifacts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Tool calls */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1 }}>TOOL CALLS</div>
            {(run.tool_calls || []).length === 0
              ? <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>No tool calls recorded for this run.</div>
              : (run.tool_calls || []).map((tc: any) => (
                <div key={tc.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-soft)" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700 }}>{tc.tool_name}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: tc.status === "ok" ? "rgba(61,219,163,0.1)" : "rgba(245,107,107,0.1)", color: tc.status === "ok" ? "var(--green)" : "var(--red)" }}>{tc.status}</span>
                    {tc.latency_ms && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{tc.latency_ms}ms</span>}
                  </div>
                  <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 8, fontSize: 10, fontFamily: "var(--mono)", margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(tc.request, null, 2)}</pre>
                </div>
              ))
            }
          </div>
          {/* Citations */}
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1 }}>CITATIONS LEDGER</div>
            {(run.citations || []).length === 0
              ? <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>No citations recorded for this run.</div>
              : (run.citations || []).map((c: any) => (
                <div key={c.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-soft)", fontSize: 12 }}>
                  <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{c.source_id}</span>
                  {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 10, fontSize: 11, color: "var(--text-muted)" }}>{c.url}</a>}
                  {c.used_in_section && <span style={{ marginLeft: 10, fontSize: 11, color: "var(--text-dim)" }}>§{c.used_in_section}</span>}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {tab === "events" && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: "var(--bg-elevated)" }}>
              {["Time", "Event", "Payload Hash", "Prev Hash"].map(h => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {events.map((e: any) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "9px 14px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{new Date(e.created_at || e.ts).toLocaleTimeString()}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 600, color: "var(--accent)" }}>{e.event_type}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>{e.payload_hash?.slice(0, 12)}…</td>
                  <td style={{ padding: "9px 14px", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>{e.prev_event_hash?.slice(0, 12) || "—"}</td>
                </tr>
              ))}
              {!events.length && <tr><td colSpan={4} style={{ padding: "16px", color: "var(--text-muted)", textAlign: "center" }}>No events</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
