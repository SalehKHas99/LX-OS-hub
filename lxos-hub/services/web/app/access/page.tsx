"use client";
import React, { useState, useEffect } from "react";
import Shell from "../_components/Shell";
import { apiGet, apiPost, apiPatch, apiDelete } from "../_components/api";

export default function AccessPage() {
  const [tab, setTab] = useState<"members"|"apikeys">("members");
  const [members, setMembers] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState("prompts:read,runs:read");
  const [newKey, setNewKey] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    apiGet("/members").then(setMembers).catch(console.error);
    apiGet("/api-keys").then(setKeys).catch(console.error);
  }

  async function inviteMember() {
    setMsg(""); setNewKey("");
    try {
      await apiPost("/members", { email: newEmail, role: newRole });
      setNewEmail(""); setMsg("✓ Member invited");
      loadAll();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  async function removeMember(id: string) {
    if (!confirm("Remove member?")) return;
    await apiDelete(`/members/${id}`);
    loadAll();
  }

  async function createKey() {
    setMsg(""); setNewKey("");
    try {
      const r = await apiPost("/api-keys", { name: newKeyName, scopes: newKeyScopes.split(",").map(s => s.trim()) });
      setNewKey(r.key);
      setNewKeyName(""); setMsg("✓ API key created — copy it now, shown once only");
      loadAll();
    } catch (e: any) { setMsg(`Error: ${e.message}`); }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke key?")) return;
    await apiDelete(`/api-keys/${id}`);
    loadAll();
  }

  const tabBtn = (t: "members"|"apikeys", label: string) => (
    <button onClick={() => setTab(t)} style={{
      padding: "8px 16px", cursor: "pointer", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600,
      background: tab === t ? "var(--bg-elevated)" : "transparent",
      color: tab === t ? "var(--text)" : "var(--text-muted)",
      border: "1px solid " + (tab === t ? "var(--border)" : "transparent"),
    }}>{label}</button>
  );

  return (
    <Shell title="Access">
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabBtn("members", "Members")}
        {tabBtn("apikeys", "API Keys")}
      </div>

      {msg && <div style={{ marginBottom: 16, padding: 12, borderRadius: "var(--radius-sm)", background: msg.startsWith("Error") ? "rgba(245,107,107,0.1)" : "rgba(61,219,163,0.1)", border: `1px solid ${msg.startsWith("Error") ? "var(--red)" : "var(--green)"}`, fontSize: 13, color: msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{msg}</div>}
      {newKey && <div style={{ marginBottom: 16, padding: 14, borderRadius: "var(--radius-sm)", background: "var(--bg-elevated)", border: "1px solid var(--green)", fontFamily: "var(--mono)", fontSize: 12, wordBreak: "break-all", color: "var(--green)" }}>🔑 {newKey}</div>}

      {tab === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>Invite Member</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com"
                style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }} />
              <select value={newRole} onChange={e => setNewRole(e.target.value)}
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }}>
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
              <button onClick={inviteMember} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "9px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Invite</button>
            </div>
          </div>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  {["Email","Role","Actions"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 12 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "10px 14px" }}>{m.email}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)" }}>{m.role}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => removeMember(m.id)} style={{ fontSize: 11, padding: "4px 10px", background: "rgba(245,107,107,0.1)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--red)" }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "apikeys" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 15 }}>Create API Key</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }} />
              <input value={newKeyScopes} onChange={e => setNewKeyScopes(e.target.value)} placeholder="scopes (comma-separated)"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 12px", color: "var(--text)", fontSize: 13 }} />
              <button onClick={createKey} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "9px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, alignSelf: "flex-start" }}>Create Key</button>
            </div>
          </div>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  {["Name","Scopes","Status","Actions"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, borderBottom: "1px solid var(--border)", fontSize: 12 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "10px 14px" }}>{k.name || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{(k.scopes || []).join(", ")}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: k.revoked_at ? "var(--red)" : "var(--green)" }}>{k.revoked_at ? "revoked" : "active"}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {!k.revoked_at && <button onClick={() => revokeKey(k.id)} style={{ fontSize: 11, padding: "4px 10px", background: "rgba(245,107,107,0.1)", border: "1px solid var(--red)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--red)" }}>Revoke</button>}
                    </td>
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
