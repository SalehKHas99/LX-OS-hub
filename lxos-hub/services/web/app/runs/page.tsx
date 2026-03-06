"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "../_components/Shell";
import { apiGet } from "../_components/api";

const statusColor = (s: string) => s === "succeeded" ? "var(--green)" : s === "failed" ? "var(--red)" : "var(--amber)";

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet("/runs?limit=100").then(setRuns).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <Shell title="Runs">
      {loading && <div style={{ color: "var(--text-muted)" }}>Loading…</div>}
      {!loading && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["ID","Status","Model","Latency","Tokens","Cost","Created"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <Link href={`/runs/${r.id}`} style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)" }}>
                      {r.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: statusColor(r.status) }}>{r.status}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>{r.model}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>{r.latency_ms ? `${r.latency_ms}ms` : "—"}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>{r.tokens_in ? `${r.tokens_in}↑ ${r.tokens_out}↓` : "—"}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>{r.cost_usd ? `$${Number(r.cost_usd).toFixed(4)}` : "—"}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 11 }}>{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>No runs yet</div>}
        </div>
      )}
    </Shell>
  );
}
