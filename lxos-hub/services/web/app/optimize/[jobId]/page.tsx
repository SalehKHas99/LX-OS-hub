"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Shell from "../../_components/Shell";
import { apiGet } from "../../_components/api";

const scoreColor = (s: number) => s >= 0.8 ? "var(--green)" : s >= 0.5 ? "var(--amber)" : "var(--red)";

export default function OptimizeJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const r = await apiGet(`/optimize/${jobId}`);
        setJob(r);
        setLoading(false);
        if (["succeeded","failed"].includes(r.status)) clearInterval(poll);
      } catch { clearInterval(poll); }
    }, 2500);
    return () => clearInterval(poll);
  }, [jobId]);

  if (loading) return <Shell title="Optimizer"><div style={{ color: "var(--text-muted)" }}>Loading…</div></Shell>;
  if (!job) return <Shell title="Optimizer"><div style={{ color: "var(--red)" }}>Job not found</div></Shell>;

  const variants = (job.variants || []).sort((a: any, b: any) => (b.aggregate_score || 0) - (a.aggregate_score || 0));
  const best = variants[0];

  return (
    <Shell title={`Optimization Job`}>
      {/* Status header */}
      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>STATUS</div>
            <span style={{ fontSize: 16, fontWeight: 800, color: job.status === "succeeded" ? "var(--green)" : job.status === "running" ? "var(--amber)" : "var(--red)" }}>
              {job.status === "running" ? "⟳ Running…" : job.status}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>OBJECTIVE</div>
            <span style={{ fontSize: 13, fontFamily: "var(--mono)" }}>{job.objective}</span>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>VARIANTS</div>
            <span style={{ fontSize: 13, fontFamily: "var(--mono)" }}>{variants.length}</span>
          </div>
          {job.promoted_prompt_version_id && (
            <div style={{ marginLeft: "auto", background: "rgba(61,219,163,0.1)", border: "1px solid rgba(61,219,163,0.4)", borderRadius: "var(--radius-sm)", padding: "8px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>✓ PROMOTED TO NEW VERSION</div>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-muted)", marginTop: 2 }}>{job.promoted_prompt_version_id?.slice(0,12)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Best variant highlight */}
      {best && job.status === "succeeded" && (
        <div style={{ background: "rgba(61,219,163,0.06)", border: "1px solid rgba(61,219,163,0.3)", borderRadius: "var(--radius)", padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", letterSpacing: 1, marginBottom: 10 }}>⚡ BEST VARIANT — PROMOTED</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "var(--mono)", color: "var(--green)" }}>{Number(best.aggregate_score || 0).toFixed(4)}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{best.variant_label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Transforms: {(best.transform_set || []).join(", ")}</div>
            </div>
          </div>
        </div>
      )}

      {/* All variants leaderboard */}
      {variants.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 12 }}>VARIANT LEADERBOARD</div>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: "var(--bg-elevated)" }}>
                {["#","Label","Transforms","Score","Case results"].map(h => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 11 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {variants.map((v: any, i: number) => (
                  <tr key={v.id} style={{ borderBottom: "1px solid var(--border-soft)", background: i === 0 ? "rgba(61,219,163,0.03)" : "transparent" }}>
                    <td style={{ padding: "9px 14px", fontSize: 11, color: i === 0 ? "var(--green)" : "var(--text-muted)", fontWeight: i === 0 ? 800 : 400 }}>{i+1}</td>
                    <td style={{ padding: "9px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>{v.variant_label}</td>
                    <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--text-muted)" }}>{(v.transform_set||[]).join(", ")}</td>
                    <td style={{ padding: "9px 14px", fontFamily: "var(--mono)", fontWeight: 700, color: scoreColor(v.aggregate_score || 0) }}>
                      {v.aggregate_score != null ? Number(v.aggregate_score).toFixed(4) : "—"}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(v.results || []).map((r: any) => (
                          <span key={r.case_id} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, background: "var(--bg-elevated)", color: scoreColor(r.score?.aggregate || 0), border: `1px solid ${scoreColor(r.score?.aggregate || 0)}` }}>
                            {r.case_id}: {Number(r.score?.aggregate||0).toFixed(2)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Best variant DSL diff */}
      {best?.dsl_yaml && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 10 }}>PROMOTED DSL (best variant)</div>
          <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 14, fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap", margin: 0 }}>{best.dsl_yaml}</pre>
        </div>
      )}

      {job.status === "running" && (
        <div style={{ marginTop: 20, color: "var(--amber)", fontSize: 13, fontFamily: "var(--mono)" }}>⟳ Auto-refreshing every 2.5s…</div>
      )}
    </Shell>
  );
}
