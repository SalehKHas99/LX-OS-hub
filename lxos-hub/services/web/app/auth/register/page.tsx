"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function setSession(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("lxos_session_token", token);
    localStorage.setItem("lxos_api_key", token);
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirm: "", username: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleUrl, setGoogleUrl] = useState("");

  useEffect(() => {
    fetch(`${API}/auth/google`)
      .then(r => r.json())
      .then(d => setGoogleUrl(d.url || ""))
      .catch(() => {});
  }, []);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, username: form.username }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Registration failed");
      setSession(data.session_token);
      router.push("/");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", padding: "11px 14px", color: "var(--text)",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--sans)" }}>
      <div style={{ width: 420, padding: 40, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 900, fontSize: 20, color: "var(--accent)", letterSpacing: 1 }}>LX-OS Hub</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Create your account</div>
        </div>

        {googleUrl && (
          <>
            <a href={googleUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "11px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", textDecoration: "none", fontSize: 14, fontWeight: 600, marginBottom: 20, boxSizing: "border-box" }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.8 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 37c10.5 0 20-7.6 20-21 0-1.4-.2-2.7-.5-4z"/>
              </svg>
              Sign up with Google
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
          </>
        )}

        <form onSubmit={register} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="text" value={form.username} onChange={update("username")}
            placeholder="Username (optional)" style={inputStyle} />
          <input type="email" value={form.email} onChange={update("email")}
            placeholder="Email address" required style={inputStyle} />
          <input type="password" value={form.password} onChange={update("password")}
            placeholder="Password (min 8 chars)" required style={inputStyle} />
          <input type="password" value={form.confirm} onChange={update("confirm")}
            placeholder="Confirm password" required style={inputStyle} />

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 13, color: "var(--red)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: "100%", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "12px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Already have an account? </span>
          <Link href="/auth/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
