"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "../_components/Shell";
import { apiGet, apiPost } from "../_components/api";

export default function OptimizePage() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [pvOptions, setPvOptions] = useState<any[]>([]);
  const [form, setForm] = useState({ promptId: "", pvId: "", benchmarkId: "", objective: "maximize_score_under_budget", maxVariants: "6" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiGet("/prompts").then(setPrompts).catch(console.error);
    apiGet("/benchmarks").then(setBenchmarks).catch(console.error);
  }, []);

  async function loadVersions(promptId: string) {
    if (!promptId) return;
    const detail = await apiGet(`/prompts/${promptId}`);
    setPvOptions(detail.versions || []);
    if (detail.versions?.length) setForm(f => ({...f, pvId: detail.versions[0].id}));
  }

  async function start() {
    if (!form.pvId || !form.benchmarkId) return;
    setMsg("");
    try {
      const r = await apiPost("/optimize", {
        prompt_version_id: form.pvId,
        benchmark_id: form.benchmarkId,
        objective: form.objective,
        budget: { max_variants: parseInt(form.maxVariants), max_total_runs: parseInt(form.maxVariants) * 10 }
      });
      setMsg(`✓ Job started: ${r.id}`);
      window.location.href = `/optimize/${r.id}`;
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  return (
    <Shell title="Optimizer">
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24, maxWidth: 600 }}>
        Automatically generate prompt variants using safe transforms, run them through a benchmark suite,
        score with the evaluator, and promote the best-performing variant to a new version.
      </p>

      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24, maxWidth: 560 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 6 }}>PROMPT</div>
            <select value={form.promptId} onChange={e => { setForm(f => ({...f, promptId: e.target.value})); loadVersions(e.target.value); }}
              style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
              <option value="">— select prompt —</option>
              {prompts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          {pvOptions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 6 }}>VERSION (baseline)</div>
              <select value={form.pvId} onChange={e => setForm(f => ({...f, pvId: e.target.value}))}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                {pvOptions.map(v => <option key={v.id} value={v.id}>v{v.version_num} — {v.commit_message}</option>)}
              </select>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 6 }}>BENCHMARK SUITE</div>
            <select value={form.benchmarkId} onChange={e => setForm(f => ({...f, benchmarkId: e.target.value}))}
              style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
              <option value="">— select suite —</option>
              {benchmarks.map(b => <option key={b.id} value={b.id}>{b.title} ({(b.cases||[]).length} cases)</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 6 }}>OBJECTIVE</div>
              <select value={form.objective} onChange={e => setForm(f => ({...f, objective: e.target.value}))}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                <option value="maximize_score_under_budget">Maximize score under budget</option>
                <option value="minimize_cost_given_score">Minimize cost given score</option>
              </select>
            </div>
            <div style={{ width: 100 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 6 }}>MAX VARIANTS</div>
              <input type="number" min="2" max="12" value={form.maxVariants} onChange={e => setForm(f => ({...f, maxVariants: e.target.value}))}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }} />
            </div>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: 1 }}>SAFE TRANSFORMS (spec §7.1)</div>
            {["tighten_constraints_clarity","add_assumptions_section_enforcement","add_refusal_templates",
              "add_format_guardrails","shorten_output_to_Z1","reorder_pipeline_for_verification"].map(t => (
              <div key={t} style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-muted)", padding: "2px 0" }}>✓ {t}</div>
            ))}
          </div>
          <button onClick={start} disabled={!form.pvId || !form.benchmarkId}
            style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "11px 22px", cursor: "pointer", fontWeight: 700, fontSize: 13, opacity: (form.pvId && form.benchmarkId) ? 1 : 0.4 }}>
            ⚡ Start Optimization
          </button>
          {msg && <div style={{ fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</div>}
        </div>
      </div>
    </Shell>
  );
}
