"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../_components/Shell";
import { apiGet, apiPost } from "../_components/api";

const DEFAULT_DSL = `lxos_version: "0.1"
title: "My Prompt"
description: "A minimal LX-OS prompt"
visibility: public

prompt_system:
  role:
    name: "Assistant"
    instructions: |
      You are a helpful assistant.
      Do not fabricate facts.
  pipeline:
    - id: draft
      type: compose
      instructions: "Answer the question clearly."
    - id: verify
      type: prism_verify
      checks: [format, safety]
    - id: package
      type: assemble_output
  output_package:
    zipper_default: Z1
  policy:
    safety:
      forbid: [bypass, fabrication, jailbreak]
`;

const SEV_COLOR: Record<string, string> = {
  error: "var(--red)", warning: "var(--amber)", info: "var(--text-muted)"
};

export default function StudioPage() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [title, setTitle] = useState("My Prompt");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [runInput, setRunInput] = useState("");
  const [runResult, setRunResult] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"library" | "builder" | "lab">("library");

  // Suggestion / validation state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugMode, setSugMode] = useState("lint_only");
  const lintTimerRef = useRef<any>(null);

  // Auto-lint on DSL change
  useEffect(() => {
    if (tab !== "builder") return;
    clearTimeout(lintTimerRef.current);
    lintTimerRef.current = setTimeout(() => runLint(), 600);
    return () => clearTimeout(lintTimerRef.current);
  }, [dsl, tab]);

  useEffect(() => { loadPrompts(); }, []);

  async function loadPrompts() {
    try { setPrompts(await apiGet("/prompts")); } catch {}
  }

  async function runLint() {
    if (!dsl.trim()) return;
    setSugLoading(true);
    try {
      const r = await apiPost("/suggest", { dsl_yaml: dsl, mode: "lint_only" });
      setSuggestions(r.suggestions || []);
    } catch {}
    setSugLoading(false);
  }

  async function runLLMSuggest() {
    setSugLoading(true);
    try {
      const r = await apiPost("/suggest", { dsl_yaml: dsl, mode: sugMode, goal: "" });
      setSuggestions(r.suggestions || []);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setSugLoading(false);
  }

  function applyPatch(patch: any) {
    if (!patch) return;
    const op = patch.op;
    if (op === "insert_pipeline_step" || op === "insert_pipeline_node") {
      const node = patch.node;
      const stepYaml = `    - id: ${node.id || node.type}\n      type: ${node.type}\n`;
      if (patch.after) {
        const after = `      type: ${patch.after}`;
        setDsl(prev => prev.includes(after) ? prev.replace(after + "\n", after + "\n" + stepYaml) : prev + stepYaml);
      } else {
        const pipelineMarker = "  pipeline:\n";
        setDsl(prev => prev.includes(pipelineMarker)
          ? prev.replace(pipelineMarker, pipelineMarker + stepYaml)
          : prev + "\n  pipeline:\n" + stepYaml);
      }
    }
  }

  const [commitMsg, setCommitMsg] = useState("");
  const [showCommit, setShowCommit] = useState(false);

  async function savePrompt() {
    setMsg("");
    try {
      // If a prompt is selected in library, add a new version; otherwise create new
      if (selected) {
        setShowCommit(true);
        return;
      }
      const r = await apiPost("/prompts", { title, description, dsl_yaml: dsl, visibility: "private", tags: tags.split(",").map(t => t.trim()).filter(Boolean) });
      setMsg(`✓ Created (v1) — ${r.id?.slice(0, 8)}`);
      loadPrompts();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  async function commitVersion() {
    if (!selected) return;
    setShowCommit(false);
    try {
      const r = await apiPost(`/prompts/${selected.id}/versions`, { dsl_yaml: dsl, message: commitMsg || "Update", compiled_template: dsl });
      setMsg(`✓ Committed v${r.version_number} — ${r.id?.slice(0, 8)}`);
      setCommitMsg("");
      loadPrompts();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  async function runPrompt() {
    if (!selected) return;
    setMsg(""); setRunResult(null);
    try {
      const detail = await apiGet(`/prompts/${selected.id}`);
      const version = detail.versions?.[0];
      if (!version) { setMsg("No version found"); return; }
      const run = await apiPost("/runs", { prompt_version_id: version.id, inputs: { input: runInput }, model: "gpt-4o-mini" });
      setMsg(`Queued: ${run.id?.slice(0, 8)}…`);
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        const r = await apiGet(`/runs/${run.id}`);
        const status = r.run?.status || r.status;
        if (["succeeded", "failed", "refused"].includes(status) || tries > 30) {
          clearInterval(poll);
          setRunResult(r.run || r);
          setMsg(`Run ${status}`);
        }
      }, 1200);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  const errCount = suggestions.filter(s => s.severity === "error").length;
  const warnCount = suggestions.filter(s => s.severity === "warning").length;

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{
      padding: "8px 18px", cursor: "pointer", borderRadius: "var(--radius-sm)",
      fontSize: 13, fontWeight: 600,
      background: tab === t ? "var(--accent)" : "var(--bg-elevated)",
      color: tab === t ? "#fff" : "var(--text-muted)",
      border: "1px solid " + (tab === t ? "var(--accent)" : "var(--border)"),
    }}>{label}</button>
  );

  return (
    <Shell title="Studio">
      {/* Version Commit Modal */}
      {showCommit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 28, width: 440 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>Commit New Version</h2>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
              Committing to: <strong style={{ color: "var(--text)" }}>{selected?.title}</strong>
            </div>
            <input value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
              placeholder="Commit message (e.g. 'Add PRISM verify step')"
              style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", color: "var(--text)", fontSize: 13, marginBottom: 16, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={commitVersion} style={{ flex: 1, background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "10px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Commit</button>
              <button onClick={() => setShowCommit(false)} style={{ flex: 1, background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {tabBtn("library", "Library")}
        {tabBtn("builder", "Builder")}
        {tabBtn("lab", "Lab")}
      </div>

      {/* ── LIBRARY ── */}
      {tab === "library" && (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, minHeight: 400 }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1 }}>MY PROMPTS</div>
            {prompts.map(p => (
              <div key={p.id} onClick={() => setSelected(p)} style={{
                padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-soft)",
                background: selected?.id === p.id ? "var(--accent-dim)" : "transparent",
                borderLeft: selected?.id === p.id ? "2px solid var(--accent)" : "2px solid transparent",
              }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.category || p.visibility}</div>
              </div>
            ))}
            {!prompts.length && <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>No prompts yet. Create one in Builder.</div>}
          </div>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            {selected ? (
              <>
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{selected.title}</h2>
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>{selected.description || "No description"}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(91,143,245,0.3)" }}>{selected.visibility}</span>
                  {selected.category && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{selected.category}</span>}
                  {selected.aggregate_score > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "rgba(61,219,163,0.1)", color: "var(--green)", border: "1px solid rgba(61,219,163,0.3)" }}>⚡ {Number(selected.aggregate_score).toFixed(3)}</span>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setTab("lab")} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Run in Lab →</button>
                  <button onClick={() => { setDsl(selected.dsl_yaml || DEFAULT_DSL); setTitle(selected.title); setTab("builder"); }}
                    style={{ background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 14px", cursor: "pointer", fontSize: 13 }}>Edit in Builder</button>
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-muted)", paddingTop: 40, textAlign: "center" }}>Select a prompt to preview</div>
            )}
          </div>
        </div>
      )}

      {/* ── BUILDER ── */}
      {tab === "builder" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
          {/* Left: editor */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Prompt title"
                style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 14px", color: "var(--text)", fontSize: 14, fontWeight: 600 }} />
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description"
                style={{ flex: 2, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 14px", color: "var(--text)", fontSize: 13 }} />
            </div>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (comma-separated: summarization, safety, z1)"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 14px", color: "var(--text)", fontSize: 12 }} />
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              <textarea value={dsl} onChange={e => setDsl(e.target.value)} rows={22}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "none", outline: "none", padding: "14px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={savePrompt} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "10px 22px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Save Prompt</button>
              <select value={sugMode} onChange={e => setSugMode(e.target.value)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 10px", color: "var(--text)", fontSize: 12 }}>
                <option value="lint_only">Lint only</option>
                <option value="lint_plus_llm">Lint + LLM</option>
              </select>
              <button onClick={runLLMSuggest} disabled={sugLoading} style={{ background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 14px", cursor: "pointer", fontSize: 12 }}>
                {sugLoading ? "Analysing…" : "Analyse"}
              </button>
              {msg && <span style={{ fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</span>}
            </div>
          </div>

          {/* Right: ValidationPanel + SuggestionPanel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Status bar */}
            <div style={{ background: "var(--bg-panel)", border: `1px solid ${errCount > 0 ? "var(--red)" : warnCount > 0 ? "var(--amber)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", gap: 14 }}>
              <span style={{ fontSize: 12, color: errCount > 0 ? "var(--red)" : "var(--text-muted)", fontWeight: 700 }}>✗ {errCount} errors</span>
              <span style={{ fontSize: 12, color: warnCount > 0 ? "var(--amber)" : "var(--text-muted)", fontWeight: 700 }}>⚠ {warnCount} warnings</span>
              {sugLoading && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>linting…</span>}
            </div>

            {/* Suggestion cards */}
            {suggestions.length === 0 && !sugLoading && (
              <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12, textAlign: "center", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                No issues found. DSL looks valid.
              </div>
            )}
            {suggestions.map((s, i) => (
              <div key={s.id || i} style={{ background: "var(--bg-panel)", border: `1px solid ${SEV_COLOR[s.severity] || "var(--border)"}`, borderRadius: "var(--radius)", padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, border: `1px solid ${SEV_COLOR[s.severity]}`, color: SEV_COLOR[s.severity] }}>{s.severity}</span>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{s.title}</span>
                  </div>
                  {s.patch && (
                    <button onClick={() => applyPatch(s.patch)} style={{ fontSize: 10, padding: "3px 9px", background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(91,143,245,0.4)", borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap" }}>
                      Apply fix
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>{s.rationale}</div>
              </div>
            ))}

            {/* DSL quick reference */}
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 1 }}>PIPELINE TYPES</div>
              {["compose", "prism_verify", "assemble_output", "tool_call", "branch"].map(t => (
                <div key={t} style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--accent)", padding: "2px 0" }}>{t}</div>
              ))}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 10, marginBottom: 4, letterSpacing: 1 }}>ZIPPER LEVELS</div>
              {["Z1 — concise", "Z2 — expanded", "Z3 — deep"].map(z => (
                <div key={z} style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-muted)", padding: "2px 0" }}>{z}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LAB ── */}
      {tab === "lab" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>PROMPT</div>
              <select value={selected?.id || ""} onChange={e => setSelected(prompts.find(p => p.id === e.target.value) || null)}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                <option value="">— select a prompt —</option>
                {prompts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>INPUT</div>
              <textarea value={runInput} onChange={e => setRunInput(e.target.value)} rows={5} placeholder="Enter your input here…"
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={runPrompt} disabled={!selected} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "10px 22px", cursor: "pointer", fontWeight: 700, fontSize: 13, opacity: selected ? 1 : 0.4 }}>Run →</button>
              {msg && <span style={{ fontSize: 13, color: msg.includes("Error") ? "var(--red)" : "var(--green)" }}>{msg}</span>}
            </div>
          </div>

          {runResult && (
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
              <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: runResult.status === "succeeded" ? "var(--green)" : "var(--red)" }}>{runResult.status}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{runResult.provider}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{runResult.latency_ms}ms</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>in:{runResult.tokens_in} out:{runResult.tokens_out}</span>
                {runResult.cost_usd > 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>${Number(runResult.cost_usd).toFixed(6)}</span>}
              </div>
              {runResult.compiled_prompt && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: 1 }}>COMPILED PROMPT</div>
                  <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 12, fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap", margin: 0, maxHeight: 160, overflowY: "auto" }}>{runResult.compiled_prompt}</pre>
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: 1 }}>OUTPUT</div>
              <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 14, fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "pre-wrap", margin: 0 }}>{runResult.output_text}</pre>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}
