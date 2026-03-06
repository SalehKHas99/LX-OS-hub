"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Shell from "../../_components/Shell";
import { apiGet, apiPost } from "../../_components/api";

const scoreColor = (s: number) => s >= 0.8 ? "var(--green)" : s >= 0.5 ? "var(--amber)" : "var(--red)";

export default function BenchmarkDetailPage() {
  const { benchmarkId } = useParams<{ benchmarkId: string }>();
  const [bench, setBench] = useState<any>(null);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selectedPV, setSelectedPV] = useState("");
  const [pvOptions, setPvOptions] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [pollResult, setPollResult] = useState<any>(null);

  useEffect(() => {
    if (!benchmarkId) return;
    apiGet(`/benchmarks/${benchmarkId}`).then(setBench).catch(console.error);
    apiGet("/prompts").then(setPrompts).catch(console.error);
  }, [benchmarkId]);

  async function loadVersions(promptId: string) {
    try {
      const detail = await apiGet(`/prompts/${promptId}`);
      setPvOptions(detail.versions || []);
      if (detail.versions?.length) setSelectedPV(detail.versions[0].id);
    } catch {}
  }

  async function runBenchmark() {
    if (!selectedPV) return;
    setRunning(true); setMsg(""); setPollResult(null);
    try {
      const r = await apiPost(`/benchmarks/${benchmarkId}/run`, { prompt_version_id: selectedPV });
      setMsg(`Queued: ${r.id?.slice(0,8)}`);
      setPollingId(r.id);
      pollForResult(r.id);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setRunning(false);
  }

  function pollForResult(runId: string) {
    let tries = 0;
    const poll = setInterval(async () => {
      tries++;
      try {
        const r = await apiGet(`/benchmarks/${benchmarkId}/runs/${runId}`);
        if (["succeeded","failed"].includes(r.status) || tries > 60) {
          clearInterval(poll);
          setPollResult(r);
          setMsg(`Run ${r.status} — score: ${r.aggregate_score}`);
          apiGet(`/benchmarks/${benchmarkId}`).then(setBench).catch(console.error);
        }
      } catch { clearInterval(poll); }
    }, 2000);
  }

  async function runOptimize() {
    if (!selectedPV) return;
    try {
      const r = await apiPost("/optimize", { prompt_version_id: selectedPV, benchmark_id: benchmarkId });
      setMsg(`Optimizer started: ${r.id?.slice(0,8)} — `);
      // redirect to optimizer page
      window.location.href = `/optimize/${r.id}`;
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  if (!bench) return <Shell title="Benchmark"><div style={{ color: "var(--text-muted)" }}>Loading…</div></Shell>;

  const cases = bench.cases || [];
  const runs = bench.runs || [];

  return (
    <Shell title={bench.title}>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>{bench.description || "No description"}</p>

      {/* Run panel */}
      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 12 }}>RUN BENCHMARK ON A PROMPT VERSION</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <select onChange={e => loadVersions(e.target.value)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
            <option value="">— select prompt —</option>
            {prompts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <select value={selectedPV} onChange={e => setSelectedPV(e.target.value)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
            <option value="">— select version —</option>
            {pvOptions.map(v => <option key={v.id} value={v.id}>v{v.version_num} — {v.commit_message}</option>)}
          </select>
          <button onClick={runBenchmark} disabled={!selectedPV || running} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, opacity: selectedPV ? 1 : 0.4 }}>
            {running ? "Starting…" : "▶ Run"}
          </button>
          <button onClick={runOptimize} disabled={!selectedPV} style={{ background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 14px", cursor: "pointer", fontSize: 13, opacity: selectedPV ? 1 : 0.4 }}>
            ⚡ Optimize
          </button>
        </div>
        {msg && <div style={{ fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</div>}
      </div>

      {/* Live result */}
      {pollResult && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 12 }}>LATEST RUN RESULT</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--mono)", color: scoreColor(pollResult.aggregate_score || 0), marginBottom: 16 }}>
            {Number(pollResult.aggregate_score || 0).toFixed(4)}
          </div>
          {(pollResult.results || []).map((r: any) => (
            <div key={r.case_id} style={{ display: "flex", gap: 12, padding: "8px 0", borderTop: "1px solid var(--border-soft)", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, width: 160 }}>{r.case_id}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(r.score?.aggregate || 0) }}>{Number(r.score?.aggregate || 0).toFixed(3)}</span>
              <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
                {Object.entries(r.score || {}).filter(([k]) => k !== "aggregate").map(([k, v]) => (
                  <span key={k} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {k}: {Number(v).toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cases */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 12 }}>CASES ({cases.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cases.map((c: any) => (
            <div key={c.id} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>{c.id}</div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>INPUTS</div>
                  <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 8, fontSize: 11, fontFamily: "var(--mono)", margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(c.inputs, null, 2)}</pre>
                </div>
                {c.expectations && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>EXPECTATIONS</div>
                    <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 8, fontSize: 11, fontFamily: "var(--mono)", margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(c.expectations, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Run history */}
      {runs.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 12 }}>HISTORY</div>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: "var(--bg-elevated)" }}>
                {["Run", "Status", "Score", "When"].map(h => <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 11 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {runs.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "8px 14px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{r.id?.slice(0,8)}</td>
                    <td style={{ padding: "8px 14px", color: r.status === "succeeded" ? "var(--green)" : "var(--amber)", fontWeight: 600 }}>{r.status}</td>
                    <td style={{ padding: "8px 14px", fontFamily: "var(--mono)", fontWeight: 700, color: scoreColor(r.aggregate_score || 0) }}>{r.aggregate_score != null ? Number(r.aggregate_score).toFixed(4) : "—"}</td>
                    <td style={{ padding: "8px 14px", fontSize: 11, color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
