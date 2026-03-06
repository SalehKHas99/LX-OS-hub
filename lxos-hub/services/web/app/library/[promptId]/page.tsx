"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Shell from "../../_components/Shell";
import { apiGet, apiPost } from "../../_components/api";

export default function PromptDetailPage() {
  const { promptId } = useParams<{ promptId: string }>();
  const [prompt, setPrompt] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [sugMode, setSugMode] = useState("lint_only");
  const [sugGoal, setSugGoal] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"readme"|"versions"|"suggest"|"discuss">("readme");

  useEffect(() => {
    if (!promptId) return;
    apiGet(`/prompts/${promptId}`).then(setPrompt).catch(console.error);
    apiGet(`/prompts/${promptId}/comments`).then(setComments).catch(console.error);
    apiGet(`/recommendations?limit=4&ref_prompt_id=${promptId}`).then(d => setSimilar(d.items || [])).catch(console.error);
  }, [promptId]);

  async function getSuggestions() {
    if (!prompt?.dsl_yaml) return;
    setMsg("");
    try {
      const r = await apiPost("/suggest", { dsl_yaml: prompt.dsl_yaml, mode: sugMode, goal: sugGoal, prompt_id: promptId });
      setSuggestions(r.suggestions || []);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  async function doRate(r: number) {
    setRating(r);
    await apiPost(`/prompts/${promptId}/rate`, { rating: r });
    setMsg("✓ Rated");
  }

  async function doFork() {
    setMsg("");
    try {
      const r = await apiPost(`/prompts/${promptId}/fork`);
      setMsg(`✓ Forked → /library/${r.id}`);
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  async function submitComment() {
    if (!comment.trim()) return;
    await apiPost(`/prompts/${promptId}/comments`, { body: comment });
    setComment("");
    apiGet(`/prompts/${promptId}/comments`).then(setComments).catch(console.error);
  }

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: "7px 16px", cursor: "pointer", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, background: tab===t ? "var(--accent)" : "var(--bg-elevated)", color: tab===t ? "#fff" : "var(--text-muted)", border: "1px solid " + (tab===t ? "var(--accent)" : "var(--border)") }}>{label}</button>
  );

  const sevColor = (s: string) => s === "error" ? "var(--red)" : s === "warning" ? "var(--amber)" : "var(--text-muted)";

  if (!prompt) return <Shell title="Prompt"><div style={{ color: "var(--text-muted)" }}>Loading…</div></Shell>;

  const latestVersion = prompt.versions?.[0];

  return (
    <Shell title={prompt.title}>
      {/* Header */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{prompt.visibility}</span>
        {prompt.category && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(91,143,245,0.3)" }}>{prompt.category}</span>}
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>⑂ {prompt.fork_count || 0}</span>
        <span style={{ fontSize: 12, color: "var(--amber)" }}>★ {Number(prompt.avg_rating || 0).toFixed(1)}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={doFork} style={{ fontSize: 12, padding: "6px 14px", background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>⑂ Fork</button>
          <Link href={`/lab`} style={{ fontSize: 12, padding: "6px 14px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", textDecoration: "none" }}>▶ Run in Lab</Link>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => doRate(n)} style={{ background: n <= rating ? "var(--amber)" : "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: n <= rating ? "#000" : "var(--text-muted)", fontSize: 12 }}>★</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabBtn("readme","Overview")} {tabBtn("versions","Versions")} {tabBtn("suggest","Suggestions")} {tabBtn("discuss","Discuss")}
      </div>

      {msg && <div style={{ marginBottom: 14, fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</div>}

      {tab === "readme" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
              <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.7, margin: "0 0 20px" }}>{prompt.description || "No description."}</p>
              {latestVersion?.compiled_template && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 1 }}>COMPILED TEMPLATE</div>
                  <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 14, fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap", margin: 0 }}>{latestVersion.compiled_template}</pre>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Tags */}
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: 1 }}>TAGS</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(prompt.tags || []).length === 0 && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>No tags</span>}
                {(prompt.tags || []).map((t: string) => (
                  <span key={t} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Benchmark score */}
            {prompt.aggregate_score > 0 && (
              <div style={{ background: "var(--bg-panel)", border: "1px solid rgba(61,219,163,0.3)", borderRadius: "var(--radius)", padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--green)" }}>{Number(prompt.aggregate_score).toFixed(3)}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Best Benchmark Score</div>
              </div>
            )}

            {/* Similar prompts */}
            {similar.length > 0 && (
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: 1 }}>SIMILAR PROMPTS</div>
                {similar.filter(s => s.id !== promptId).slice(0,3).map((s: any) => (
                  <Link key={s.id} href={`/library/${s.id}`} style={{ display: "block", padding: "8px 0", borderBottom: "1px solid var(--border-soft)", textDecoration: "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{s.title}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 10, color: "var(--text-muted)" }}>
                      {s.tag_overlap > 0 && <span>{s.tag_overlap} shared tags</span>}
                      {s.aggregate_score > 0 && <span>⚡{Number(s.aggregate_score).toFixed(2)}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "versions" && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--bg-elevated)" }}>
              {["Version","Message","Created"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 12 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(prompt.versions || []).map((v: any) => (
                <tr key={v.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>v{v.version_num}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>{v.commit_message}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)" }}>{new Date(v.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "suggest" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 640 }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={sugMode} onChange={e => setSugMode(e.target.value)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 12px", color: "var(--text)", fontSize: 13 }}>
                <option value="lint_only">Lint only (fast, deterministic)</option>
                <option value="lint_plus_llm">Lint + LLM (thorough)</option>
              </select>
              <input value={sugGoal} onChange={e => setSugGoal(e.target.value)} placeholder="Goal (e.g. improve reliability)"
                style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 12px", color: "var(--text)", fontSize: 13 }} />
              <button onClick={getSuggestions} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Analyse</button>
            </div>
          </div>
          {suggestions.map((s, i) => (
            <div key={s.id || i} style={{ background: "var(--bg-panel)", border: `1px solid ${sevColor(s.severity)}`, borderRadius: "var(--radius)", padding: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: `1px solid ${sevColor(s.severity)}`, color: sevColor(s.severity) }}>{s.severity}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{s.rationale}</div>
              {s.patch && <pre style={{ marginTop: 8, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 10, fontSize: 11, fontFamily: "var(--mono)", whiteSpace: "pre-wrap" }}>{JSON.stringify(s.patch, null, 2)}</pre>}
            </div>
          ))}
          {suggestions.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Click Analyse to get suggestions.</div>}
        </div>
      )}

      {tab === "discuss" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 580 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Leave a comment…" rows={3}
              style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text)", fontSize: 13, resize: "vertical" }} />
            <button onClick={submitComment} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "10px 16px", cursor: "pointer", fontWeight: 600, alignSelf: "flex-end" }}>Post</button>
          </div>
          {comments.map((c: any) => (
            <div key={c.id} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{c.username} · {new Date(c.created_at).toLocaleString()}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{c.body}</div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
