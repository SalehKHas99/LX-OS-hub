"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "../_components/Shell";
import { apiGet, apiPost } from "../_components/api";

const scoreColor = (s: string) => s === "succeeded" ? "var(--green)" : s === "failed" || s === "refused" ? "var(--red)" : "var(--amber)";

export default function LabPage() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [pvOptions, setPvOptions] = useState<any[]>([]);
  const [selectedPV, setSelectedPV] = useState<any>(null);
  const [model, setModel] = useState("gpt-4o-mini");
  const [inputs, setInputs] = useState<Record<string, string>>({ input: "" });
  const [customInput, setCustomInput] = useState("");
  const [runs, setRuns] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiGet("/prompts").then(setPrompts).catch(console.error);
    apiGet("/runs?limit=10").then(setRuns).catch(console.error);
  }, []);

  async function loadVersions(promptId: string) {
    if (!promptId) return;
    const d = await apiGet(`/prompts/${promptId}`);
    setPvOptions(d.versions || []);
    if (d.versions?.length) setSelectedPV(d.versions[0]);
  }

  async function run() {
    if (!selectedPV) return;
    setRunning(true); setMsg("");
    const inputPayload = customInput
      ? (() => { try { return JSON.parse(customInput); } catch { return { input: customInput }; } })()
      : inputs;
    try {
      const r = await apiPost("/runs", { prompt_version_id: selectedPV.id, inputs: inputPayload, model });
      setMsg(`Queued: ${r.id?.slice(0,8)}`);
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        const result = await apiGet(`/runs/${r.id}`);
        const run = result.run || result;
        if (["succeeded","failed","refused"].includes(run.status) || tries > 30) {
          clearInterval(poll);
          setRuns(prev => [run, ...prev.slice(0, 9)]);
          setMsg(`Run ${run.status}`);
        }
      }, 1200);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setRunning(false);
  }

  return (
    <Shell title="Testing Lab">
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20, alignItems: "start" }}>
        {/* Run form */}
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 14 }}>RUN CONFIGURATION</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>PROMPT</div>
            <select onChange={e => loadVersions(e.target.value)} style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
              <option value="">— select —</option>
              {prompts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          {pvOptions.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>VERSION</div>
              <select value={selectedPV?.id || ""} onChange={e => setSelectedPV(pvOptions.find(v => v.id === e.target.value))}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                {pvOptions.map(v => <option key={v.id} value={v.id}>v{v.version_num} — {v.commit_message}</option>)}
              </select>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>MODEL</div>
            <select value={model} onChange={e => setModel(e.target.value)} style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="claude-haiku-4-5-20251001">claude-haiku (Anthropic)</option>
              <option value="claude-sonnet-4-6">claude-sonnet (Anthropic)</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>INPUT</div>
            <textarea value={customInput} onChange={e => setCustomInput(e.target.value)} rows={6}
              placeholder='{"input": "your input here"} or just plain text'
              style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <button onClick={run} disabled={!selectedPV || running}
            style={{ width: "100%", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "11px 0", cursor: "pointer", fontWeight: 700, fontSize: 14, opacity: selectedPV ? 1 : 0.4 }}>
            {running ? "Submitting…" : "▶ Run"}
          </button>
          {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</div>}
        </div>

        {/* Recent runs */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 14 }}>RECENT RUNS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {runs.map(r => (
              <Link key={r.id} href={`/runs/${r.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{r.id?.slice(0,8)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(r.status) }}>{r.status}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.provider}</span>
                    {r.latency_ms && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.latency_ms}ms</span>}
                    {r.cost_usd > 0 && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>${Number(r.cost_usd).toFixed(5)}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleTimeString()}</span>
                  </div>
                  {r.output_text && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)", background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
                      {r.output_text.slice(0, 120)}{r.output_text.length > 120 ? "…" : ""}
                    </div>
                  )}
                </div>
              </Link>
            ))}
            {runs.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 20 }}>No runs yet. Submit one above.</div>}
          </div>
        </div>
      </div>
    </Shell>
  );
}
