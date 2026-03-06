"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Shell from "../_components/Shell";
import { apiGet, apiPost, apiPatch, apiDelete } from "../_components/api";

export default function IntegrationsPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState("RUN_SUCCEEDED,RUN_FAILED");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    apiGet("/webhooks").then(setWebhooks).catch(console.error).finally(() => setLoading(false));
  }

  async function create() {
    setMsg("");
    try {
      await apiPost("/webhooks", { url: newUrl, events: newEvents.split(",").map(s => s.trim()) });
      setNewUrl(""); setMsg("✓ Webhook created");
      load();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  async function toggle(w: any) {
    await apiPatch(`/webhooks/${w.id}`, { enabled: !w.enabled });
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete webhook?")) return;
    await apiDelete(`/webhooks/${id}`);
    load();
  }

  return (
    <Shell title="Integrations">
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <Link href="/integrations" style={{ padding: "8px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", fontSize: 13, fontWeight: 600 }}>Webhooks</Link>
        <Link href="/integrations/inbox" style={{ padding: "8px 16px", background: "transparent", border: "1px solid transparent", borderRadius: "var(--radius-sm)", color: "var(--text-muted)", fontSize: 13 }}>Inbox</Link>
      </div>

      <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20, maxWidth: 600 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>Add Webhook</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://your-endpoint.com/hook"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }} />
          <input value={newEvents} onChange={e => setNewEvents(e.target.value)} placeholder="Events (comma-separated)"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }} />
          <button onClick={create} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: 13, alignSelf: "flex-start" }}>
            Create
          </button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</div>}
      </div>

      {!loading && (
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                {["URL","Events","Status","Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>
                    <Link href={`/integrations/webhooks/${w.id}`} style={{ color: "var(--accent)" }}>{w.url.slice(0, 50)}…</Link>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)" }}>{(w.events || []).join(", ")}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: w.enabled ? "var(--green)" : "var(--text-muted)" }}>{w.enabled ? "active" : "disabled"}</span>
                  </td>
                  <td style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
                    <button onClick={() => toggle(w)} style={{ fontSize: 11, padding: "4px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text)" }}>
                      {w.enabled ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => del(w.id)} style={{ fontSize: 11, padding: "4px 10px", background: "rgba(245,107,107,0.1)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--red)" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {webhooks.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>No webhooks configured</div>}
        </div>
      )}
    </Shell>
  );
}
