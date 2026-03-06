"use client";
import React, { useState, useEffect } from "react";
import Shell from "../_components/Shell";
import { apiPost, apiGet, setApiKey } from "../_components/api";

export default function SetupPage() {
  const [status, setStatus] = useState<any>(null);
  const [seedResult, setSeedResult] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet("/demo/status").then(setStatus).catch(() => {});
  }, []);

  async function handleSeed() {
    setLoading(true); setMsg("");
    try {
      const r = await apiPost("/demo/seed");
      setSeedResult(r);
      if (r.key) { setApiKey(r.key); setApiKeyInput(r.key); }
      const s = await apiGet("/demo/status");
      setStatus(s);
      setMsg("✓ Demo seeded successfully");
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setLoading(false);
  }

  function saveKey() {
    setApiKey(apiKeyInput);
    setMsg("✓ API key saved to localStorage");
  }

  return (
    <Shell title="Setup">
      <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 20 }}>

        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Current Status</h2>
          {status ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {Object.entries(status).map(([k, v]) => (
                <div key={k} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--accent)" }}>{String(v)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{k}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: "var(--text-muted)" }}>Loading…</div>}
        </div>

        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Bootstrap Demo Data</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 14px" }}>
            Seeds sample prompts, runs, a simulator receiver, webhook, and API key.
          </p>
          <button
            onClick={handleSeed}
            disabled={loading}
            style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "10px 20px", cursor: "pointer", fontWeight: 600, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Seeding…" : "Run Demo Bootstrap"}
          </button>
          {seedResult?.key && (
            <div style={{ marginTop: 12, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: 12, fontFamily: "var(--mono)", fontSize: 12, wordBreak: "break-all", color: "var(--green)" }}>
              API Key: {seedResult.key}
            </div>
          )}
        </div>

        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Set API Key</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>Stored in localStorage for UI auth.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="lxos_..."
              style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 12 }}
            />
            <button onClick={saveKey} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 16px", cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>
              Save
            </button>
          </div>
        </div>

        {msg && <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: msg.startsWith("Error") ? "rgba(245,107,107,0.1)" : "rgba(61,219,163,0.1)", border: `1px solid ${msg.startsWith("Error") ? "var(--red)" : "var(--green)"}`, fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</div>}
      </div>
    </Shell>
  );
}
