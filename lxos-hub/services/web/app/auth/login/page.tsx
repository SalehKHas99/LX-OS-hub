"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setApiKey } from "../../_components/api";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function setSession(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("lxos_session_token", token);
    localStorage.setItem("lxos_api_key", token);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleUrl, setGoogleUrl] = useState("");

  useEffect(() => {
    // Check for session_token in URL (Google callback)
    const params = new URLSearchParams(window.location.search);
    const token = params.get("session_token");
    if (token) {
      setSession(token);
      router.push("/");
      return;
    }
    // Fetch Google OAuth URL
    fetch(`${API}/auth/google`)
      .then(r => r.json())
      .then(d => setGoogleUrl(d.url || ""))
      .catch(() => {});
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Login failed");
      setSession(data.session_token);
      router.push("/");
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", padding: "11px 14px", color: "var(--text)",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--sans)" }}>
      <div style={{ width: 400, padding: 40, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 900, fontSize: 20, color: "var(--accent)", letterSpacing: 1 }}>LX-OS Hub</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Sign in to your account</div>
        </div>

        {/* Google OAuth */}
        {googleUrl ? (
          <a href={googleUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "11px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", textDecoration: "none", fontSize: 14, fontWeight: 600, marginBottom: 20, boxSizing: "border-box" }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.8 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.2-2.7-.5-4z"/>
              <path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.3 4-18.1 9.8"/>
              <path fill="#FBBC05" d="M24 45c5.5 0 10.5-2 14.3-5.4l-6.6-5.4C29.7 36 27 37 24 37c-5.8 0-10.7-3.8-12.5-9L4.7 33.2C8.5 40.5 15.7 45 24 45z"/>
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-1 3-3.3 5.4-6.3 7l6.6 5.4C40.2 37 44.5 31 44.5 24c0-1.4-.2-2.7-.5-4z"/>
            </svg>
            Continue with Google
          </a>
        ) : (
          <div style={{ height: 44, marginBottom: 20, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Google OAuth not configured</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Email form */}
        <form onSubmit={login} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" required style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required style={inputStyle} />

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 13, color: "var(--red)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: "100%", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "12px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Don't have an account? </span>
          <Link href="/auth/register" style={{ color: "var(--accent)", fontWeight: 600 }}>Sign up</Link>
        </div>
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 12, color: "var(--text-dim)" }}>Continue without account →</Link>
        </div>
      </div>
    </div>
  );
}
