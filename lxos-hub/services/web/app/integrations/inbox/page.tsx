"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "../../_components/Shell";
import { apiGet } from "../../_components/api";

export default function InboxPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet("/sim/inbox?limit=100").then(setItems).catch(console.error).finally(() => setLoading(false));
    const t = setInterval(() => apiGet("/sim/inbox?limit=100").then(setItems).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <Shell title="Webhook Simulator Inbox">
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <Link href="/integrations" style={{ padding: "8px 16px", background: "transparent", border: "1px solid transparent", borderRadius: "var(--radius-sm)", color: "var(--text-muted)", fontSize: 13 }}>Webhooks</Link>
        <Link href="/integrations/inbox" style={{ padding: "8px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 13, fontWeight: 600 }}>Inbox</Link>
      </div>

      {loading && <div style={{ color: "var(--text-muted)" }}>Loading…</div>}
      {!loading && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["Received","Event","Sig Valid","Body Preview"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{new Date(item.received_at).toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>{item.event_type}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: item.sig_valid ? "var(--green)" : "var(--red)" }}>{item.sig_valid ? "✓ valid" : "✗ invalid"}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {JSON.stringify(item.body).slice(0, 80)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>No events received yet</div>}
        </div>
      )}
    </Shell>
  );
}
